import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { showLocalNotification, getRoomLastSeen, installNativeNotificationTapHandler } from "@/lib/notify";
import { ensureNotificationPermission } from "@/lib/app-permissions";
import { getOnline } from "@/lib/use-online";

type RoomLite = { id: string; name: string | null };
type JoinedRoomRow = { rooms?: RoomLite | null };
type NotificationMessage = {
  id?: string;
  sender_id?: string;
  user_id?: string;
  room_id?: string;
  content?: string;
  message_type?: string | null;
};

/** Total unread room messages across all rooms the user is a member of, based on per-room lastSeen. */
export function useUnreadRoomCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const roomsRef = useRef<RoomLite[]>([]);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    if (!getOnline()) { setCount(0); return; }
    let mounted = true;

    const recompute = async () => {
      const rooms = roomsRef.current;
      if (rooms.length === 0) { if (mounted) setCount(0); return; }
      let total = 0;
      // Run in parallel
      await Promise.all(rooms.map(async (r) => {
        const since = getRoomLastSeen(r.id);
        try {
          const { count: c } = await supabase
            .from("room_messages")
            .select("id", { count: "exact", head: true })
            .eq("room_id", r.id)
            .gt("created_at", since)
            .neq("user_id", user.id);
          total += c ?? 0;
        } catch {
          /* keep local count */
        }
      }));
      if (mounted) setCount(total);
    };

    const loadRoomsAndCount = async () => {
      let data: JoinedRoomRow[] | null = null;
      try {
        const res = await supabase
          .from("room_members")
          .select("room_id, rooms(id, name)")
          .eq("user_id", user.id);
        data = res.data as JoinedRoomRow[] | null;
      } catch {
        data = null;
      }
      const rooms: RoomLite[] = (data ?? [])
        .map((r) => r.rooms ? { id: r.rooms.id, name: r.rooms.name } : null)
        .filter(Boolean) as RoomLite[];
      roomsRef.current = rooms;
      recompute();
    };

    loadRoomsAndCount();

    // Re-count whenever any new room message arrives (we can't easily filter by membership; recompute).
    const ch = supabase
      .channel(`rooms-unread:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages" }, () => {
        recompute();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `user_id=eq.${user.id}` }, () => {
        loadRoomsAndCount();
      })
      .subscribe();

    // Recount when tab regains focus (lastSeen may have changed in another tab/route)
    const onVis = () => { if (document.visibilityState === "visible") recompute(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [user]);

  return count;
}

/** Listens for new DMs and room messages globally and fires native/web notifications. */
export function useGlobalNotificationListener(navigateTo?: (url: string) => void): void {
  const { user } = useAuth();
  const myRoomsRef = useRef<Map<string, string>>(new Map()); // roomId -> name
  const profileCacheRef = useRef<Map<string, string>>(new Map()); // userId -> username

  useEffect(() => {
    if (!user) return;
    if (!getOnline()) return;
    let mounted = true;

    // Ask once (no-op if already granted/denied)
    ensureNotificationPermission().catch(() => {});
    if (navigateTo) installNativeNotificationTapHandler(navigateTo).catch(() => {});

    const loadRooms = async () => {
      let data: JoinedRoomRow[] | null = null;
      try {
        const res = await supabase
          .from("room_members")
          .select("room_id, rooms(id, name)")
          .eq("user_id", user.id);
        data = res.data as JoinedRoomRow[] | null;
      } catch {
        data = null;
      }
      const m = new Map<string, string>();
      (data ?? []).forEach((r) => {
        if (r.rooms?.id) m.set(r.rooms.id, r.rooms.name ?? "غرفة");
      });
      if (mounted) myRoomsRef.current = m;
    };
    loadRooms();

    const getUsername = async (uid: string): Promise<string> => {
      if (profileCacheRef.current.has(uid)) return profileCacheRef.current.get(uid)!;
      let data: { username: string | null } | null = null;
      try {
        const res = await supabase.from("profiles").select("username").eq("id", uid).maybeSingle();
        data = res.data;
      } catch {
        data = null;
      }
      const name = data?.username ?? "مستخدم";
      profileCacheRef.current.set(uid, name);
      return name;
    };

    const previewText = (m: NotificationMessage): string => {
      if (m.message_type === "image") return "🖼️ صورة";
      if (m.message_type === "voice") return "🎙️ رسالة صوتية";
      return (m.content as string)?.slice(0, 120) || "رسالة جديدة";
    };

    const ch = supabase
      .channel(`global-notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `receiver_id=eq.${user.id}` },
        async (p) => {
          const m = p.new as NotificationMessage;
          if (!m.sender_id) return;
          const name = await getUsername(m.sender_id);
          showLocalNotification({
            title: name,
            body: previewText(m),
            url: `/app/chats/${m.sender_id}`,
            tag: `dm:${m.sender_id}`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "room_messages" },
        async (p) => {
          const m = p.new as NotificationMessage;
          if (!m.room_id || !m.user_id || m.user_id === user.id) return;
          const roomName = myRoomsRef.current.get(m.room_id);
          if (!roomName) return; // not a member
          const name = await getUsername(m.user_id);
          showLocalNotification({
            title: `${roomName} · ${name}`,
            body: previewText(m),
            url: `/app/rooms/${m.room_id}`,
            tag: `room:${m.room_id}`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `user_id=eq.${user.id}` },
        () => { loadRooms(); }
      )
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [user, navigateTo]);
}
