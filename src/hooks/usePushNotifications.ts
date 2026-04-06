import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Registers for push notifications via @capacitor/push-notifications
 * when running inside Capacitor. Falls back gracefully in browser/PWA.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current) return;

    const registerPush = async () => {
      try {
        // Dynamic import to avoid errors in non-Capacitor environments
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { Capacitor } = await import("@capacitor/core");

        if (!Capacitor.isNativePlatform()) return;

        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          console.log("Push permission not granted");
          return;
        }

        // Register with FCM
        await PushNotifications.register();

        // Listen for token
        PushNotifications.addListener("registration", async (token) => {
          console.log("Push token:", token.value);
          registeredRef.current = true;

          // Upsert token in database
          const { error } = await supabase.from("push_tokens" as any).upsert(
            {
              user_id: user.id,
              token: token.value,
              platform: "android",
            },
            { onConflict: "token" }
          );

          if (error) {
            console.error("Failed to save push token:", error);
          }
        });

        // Handle registration errors
        PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        // Handle incoming notifications when app is in foreground
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          toast.info(notification.title ?? "Notification", {
            description: notification.body ?? "",
            duration: 6000,
          });
        });

        // Handle notification tap (app opened from notification)
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data;
          if (data?.route) {
            window.location.href = data.route;
          }
        });
      } catch (e) {
        // Not in Capacitor environment, silently ignore
        console.log("Push notifications not available:", e);
      }
    };

    registerPush();
  }, [user]);
}
