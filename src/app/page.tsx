import LeftSidebar from "@/components/LeftSidebar";
import MainContent from "@/components/MainContent";
import RightSidebar from "@/components/RightSidebar";
import { LegislationProvider } from "@/context/LegislationContext";

export default function Home() {
  return (
    <LegislationProvider>
      <div className="flex h-full">
        {/* Left Sidebar */}
        <div className="w-1/5 min-w-[250px] bg-gray-100 border-r border-gray-300 overflow-y-auto">
          <LeftSidebar />
        </div>

        {/* Main Content Area */}
        <div className="flex-grow bg-white overflow-y-auto">
          <MainContent />
        </div>

        {/* Right Sidebar (Resizable Chat) - Resizing needs JS, basic structure for now */}
        <div className="w-1/4 min-w-[300px] bg-gray-50 border-l border-gray-300 overflow-y-auto">
          {/* We'll add resizing later */}
          <RightSidebar />
        </div>
      </div>
    </LegislationProvider>
  );
}
