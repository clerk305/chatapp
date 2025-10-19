"use client"
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const HomePage = () => {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], groups: [] });
  const [activeTab, setActiveTab] = useState("users");
  const [activeChats, setActiveChats] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchUserDetails();
    fetchActiveChats();
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim()) {
        try {
          const [usersResponse, groupsResponse] = await Promise.all([
            axios.get(`http://localhost:4000/search/users?query=${searchQuery}`, {
              withCredentials: true,
            }),
            axios.get(`http://localhost:4000/search/groups?query=${searchQuery}`, {
              withCredentials: true,
            }),
          ]);

          setSearchResults({
            users: usersResponse.data,
            groups: groupsResponse.data,
          });
        } catch (error) {
          console.error("Error searching:", error);
        }
      } else {
        setSearchResults({ users: [], groups: [] });
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const fetchActiveChats = async () => {
    try {
      const response = await axios.get("http://localhost:4000/active-chats", {
        withCredentials: true,
      });
      setActiveChats(response.data);
    } catch (error) {
      console.error("Error fetching active chats:", error);
    }
  };

  const fetchUserDetails = async () => {
    try {
      const response = await axios.get("http://localhost:4000/me", {
        withCredentials: true,
      });
      setUsername(response.data);
    } catch (error) {
      console.error("Error fetching user details:", error);
      router.push("/login");
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:4000/logout", {}, { withCredentials: true });
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleStartChat = async (userId) => {
    try {
      const response = await axios.get(`http://localhost:4000/chat/${userId}`, {
        withCredentials: true,
      });
      router.push(`/chat/${userId}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await axios.post(
        `http://localhost:4000/groups/${groupId}/members`,
        {},
        { withCredentials: true }
      );
      router.push(`/group/${groupId}`);
    } catch (error) {
      console.error("Error joining group:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.error || "You are already a member of this group");
      } else {
        alert("Failed to join the group. Please try again.");
      }
    }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      const response = await axios.delete(
        `http://localhost:4000/groups/${groupId}/members/${username.id}`,
        { withCredentials: true }
      );
      
      // Show success message
      alert(response.data.message || "Successfully left the group");
      
      // Refresh search results
      if (searchQuery.trim()) {
        const [usersResponse, groupsResponse] = await Promise.all([
          axios.get(`http://localhost:4000/search/users?query=${searchQuery}`, {
            withCredentials: true,
          }),
          axios.get(`http://localhost:4000/search/groups?query=${searchQuery}`, {
            withCredentials: true,
          }),
        ]);
        setSearchResults({
          users: usersResponse.data,
          groups: groupsResponse.data,
        });
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      // Show specific error message from the server if available
      const errorMessage = error.response?.data?.error || "Failed to leave the group. Please try again.";
      alert(errorMessage);
      
      // If the error is because user is not a member, refresh the search results
      if (error.response?.status === 404) {
        if (searchQuery.trim()) {
          const [usersResponse, groupsResponse] = await Promise.all([
            axios.get(`http://localhost:4000/search/users?query=${searchQuery}`, {
              withCredentials: true,
            }),
            axios.get(`http://localhost:4000/search/groups?query=${searchQuery}`, {
              withCredentials: true,
            }),
          ]);
          setSearchResults({
            users: usersResponse.data,
            groups: groupsResponse.data,
          });
        }
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">مرحبًا، {username?.name || "المستخدم"}!</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            تسجيل الخروج
          </button>
        </div>

        <div className="p-4">
          <div className="mb-6">
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مستخدمين أو مجموعات..."
                className="flex-grow border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {searchQuery && (
              <div className="mb-6">
                <div className="flex gap-4 mb-2">
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`px-4 py-2 rounded-lg ${
                      activeTab === "users"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    المستخدمين
                  </button>
                  <button
                    onClick={() => setActiveTab("groups")}
                    className={`px-4 py-2 rounded-lg ${
                      activeTab === "groups"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    المجموعات
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  {activeTab === "users" ? (
                    <div className="space-y-2">
                      {searchResults.users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm"
                        >
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <button
                            onClick={() => handleStartChat(user.id)}
                            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                          >
                            محادثة
                          </button>
                        </div>
                      ))}
                      {searchResults.users.length === 0 && (
                        <p className="text-center text-gray-500">لا توجد نتائج</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.groups.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm"
                        >
                          <div>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-sm text-gray-500">
                              {group.members.length} عضو
                            </p>
                          </div>
                          {group.isMember ? (
                            <button
                              onClick={() => handleLeaveGroup(group.id)}
                              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                            >
                              خروج
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinGroup(group.id)}
                              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                            >
                              انضمام
                            </button>
                          )}
                        </div>
                      ))}
                      {searchResults.groups.length === 0 && (
                        <p className="text-center text-gray-500">لا توجد نتائج</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">المحادثات النشطة</h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {activeChats.length > 0 ? (
                    activeChats.map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/chat/${chat.otherUser.id}`)}
                      >
                        <div>
                          <p className="font-medium">{chat.otherUser.name}</p>
                          <p className="text-sm text-gray-500">
                            {chat.lastMessage?.content || "لا توجد رسائل"}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {chat.lastMessage?.createdAt
                            ? new Date(chat.lastMessage.createdAt).toLocaleTimeString()
                            : ""}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500">لا توجد محادثات نشطة</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => router.push("/create-group")}
                  className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <span>إنشاء مجموعة جديدة</span>
                </button>
                <button
                  onClick={() => router.push("/groups")}
                  className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
                >
                  <span>عرض مجموعاتي</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 