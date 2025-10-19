//src/app/groups/page.js
"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const GroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await axios.get("http://localhost:4000/all-groups", {
          withCredentials: true,
        });
        setGroups(response.data);
      } catch (error) {
        console.error("❌ خطأ في جلب المجموعات:", error);
      }
    };

    const fetchMe = async () => {
      try {
        const res = await axios.get("http://localhost:4000/me", {
          withCredentials: true,
        });
        setCurrentUserId(res.data.id);
      } catch (error) {
        console.error("❌ خطأ في جلب المستخدم:", error);
      }
    };

    fetchMe();
    fetchGroups();
  }, []);

  const handleGroupClick = (groupid) => {
    router.push(`/group/${groupid}`);
  };

  const isUserAdmin = (group) => {
    const member = group.members.find((m) => m.userId === currentUserId);
    return member?.isAdmin || false;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-center mb-4">مجموعاتي</h1>
      <div className="bg-gray-100 p-4 rounded-lg h-64 overflow-y-auto space-y-2">
        {groups.map((group) => {
          const isAdmin = isUserAdmin(group);
          return (
            <div
              key={group.id}
              className="bg-red-700 shadow p-2 rounded-md text-sm"
            >
              <h2>{group.name}</h2>
              <button onClick={() => handleGroupClick(group.id)}>
                فتح المجموعة
              </button>
              <p>
                {isAdmin
                  ? "أنت مشرف في هذه المجموعة"
                  : "أنت عضو في هذه المجموعة"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupsPage;
