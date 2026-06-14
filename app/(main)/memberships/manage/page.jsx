"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MembershipsManage({ params }) {
    const [groupId, setGroupId] = useState("");
    const [userId, setUserId] = useState("");
    const [joinedAt, setJoinedAt] = useState("");
    const [leftAt, setLeftAt] = useState("");

    const list = useQuery(api.memberships.listForGroup, groupId ? { groupId } : "skip");
    const upsert = useMutation(api.memberships.upsert);

    const handleAdd = async () => {
        if (!groupId || !userId || !joinedAt) return;
        const j = new Date(joinedAt).getTime();
        const l = leftAt ? new Date(leftAt).getTime() : undefined;
        await upsert({ groupId, userId, role: "member", joinedAt: j, leftAt: l });
        alert("Membership added");
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl mb-4">Manage Memberships</h2>
            <div className="space-y-3 max-w-xl">
                <Input placeholder="GroupId" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
                <Input placeholder="UserId" value={userId} onChange={(e) => setUserId(e.target.value)} />
                <label className="block">Joined At</label>
                <Input type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
                <label className="block">Left At (optional)</label>
                <Input type="date" value={leftAt} onChange={(e) => setLeftAt(e.target.value)} />
                <div className="flex gap-2">
                    <Button onClick={handleAdd}>Add membership</Button>
                    <Button onClick={async () => { if (groupId) await api.imports.redetect({ importId: groupId }); }}>Re-detect imports</Button>
                </div>

                <div className="mt-6">
                    <h3 className="text-lg">Membership events</h3>
                    <ul>
                        {(list || []).map((m) => (
                            <li key={m._id}>{m.userId} — {new Date(m.joinedAt).toLocaleDateString()} {m.leftAt ? `to ${new Date(m.leftAt).toLocaleDateString()}` : "(present)"}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
