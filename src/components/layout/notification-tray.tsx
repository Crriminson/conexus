"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Notification {
  id: string;
  userId: string;
  projectId: string;
  type: string;
  message: string;
  relatedEntityId: string | null;
  readStatus: boolean;
  createdAt: string;
}

export function NotificationTray({ userId }: { userId?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;

    // Fetch initial notifications
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from("Notification")
        .select("*")
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .limit(20);

      if (data && !error) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n) => !n.readStatus).length);
      }
    };

    fetchNotifications();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Notification",
          filter: `userId=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
          } else if (payload.eventType === "UPDATE") {
            const updatedNotif = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
            setUnreadCount((prev) =>
              prev + (updatedNotif.readStatus ? -1 : 1)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const markAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readStatus: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Update DB
    await supabase
      .from("Notification")
      .update({ readStatus: true })
      .eq("id", id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.readStatus).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
    setUnreadCount(0);

    // Because there's no native updateMany by array via simple filter easily, we can just run a query
    await supabase
      .from("Notification")
      .update({ readStatus: true })
      .in("id", unreadIds);
  };

  if (!userId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-sidebar-foreground/70 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-sidebar border-sidebar-border text-sidebar-foreground">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0 font-medium text-white">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-sidebar-foreground/70 hover:text-white">
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-sidebar-border" />
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-sidebar-foreground/50">
              No new notifications
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-1">
              {notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className={`flex flex-col items-start gap-1 cursor-pointer p-3 focus:bg-sidebar-accent/50 ${
                    !notif.readStatus ? "bg-sidebar-accent/20" : ""
                  }`}
                  onClick={() => {
                    if (!notif.readStatus) markAsRead(notif.id);
                    // Could router.push to the relevant entity here using notif.relatedEntityId
                  }}
                >
                  <div className="flex w-full justify-between items-start gap-2">
                    <span className="text-sm font-medium text-white leading-tight">
                      {notif.type}
                    </span>
                    {!notif.readStatus && (
                      <Badge variant="default" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-[10px] h-4 px-1.5">
                        New
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-sidebar-foreground/70 leading-snug line-clamp-2">
                    {notif.message}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/40 mt-1">
                    {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
