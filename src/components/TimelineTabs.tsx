export type TabCategory = "IN_BERAAD" | "GEPLAND" | "ARCHIEF";

export function categorizeQuizForTabs(quiz: {
  startsAt: Date;
  status: "OPEN" | "CANCELLED" | "ARCHIVED";
  team: { registeredAt: Date | null };
}): TabCategory {
  const isPast = new Date(quiz.startsAt).getTime() < Date.now();
  if (isPast || quiz.status === "ARCHIVED" || quiz.status === "CANCELLED") {
    return "ARCHIEF";
  }
  if (quiz.team.registeredAt !== null) {
    return "GEPLAND";
  }
  return "IN_BERAAD";
}

interface TimelineTabsProps {
  activeTab: TabCategory;
  onTabChange: (tab: TabCategory) => void;
  counts: Record<TabCategory, number>;
}

export function TimelineTabs({ activeTab, onTabChange, counts }: TimelineTabsProps) {
  const tabs: Array<{ id: TabCategory; label: string }> = [
    { id: "IN_BERAAD", label: "In Beraad" },
    { id: "GEPLAND", label: "Gepland" },
    { id: "ARCHIEF", label: "Archief" },
  ];

  return (
    <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-sm font-medium">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-center transition-all ${
              isActive
                ? "bg-white text-blue-600 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label} ({counts[tab.id] || 0})
          </button>
        );
      })}
    </div>
  );
}
