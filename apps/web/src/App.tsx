import { useState } from "react";

import { Shell } from "./components/Shell";
import { ChatPage } from "./pages/ChatPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { OpsPage } from "./pages/OpsPage";

type TabKey = "knowledge" | "chat" | "ops";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("knowledge");

  return (
    <Shell activeTab={activeTab} onTabChange={setActiveTab}>
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Demo Console</p>
          <h2>把知识检索、对话和 AIOps 串成一条可演示的 Agent 主链路</h2>
        </div>
        <div className="hero-metrics">
          <article>
            <strong>OpenAPI</strong>
            <span>Contract-first</span>
          </article>
          <article>
            <strong>GoFrame</strong>
            <span>DAO-style API</span>
          </article>
          <article>
            <strong>SSE</strong>
            <span>Streaming UX</span>
          </article>
        </div>
      </header>

      {activeTab === "knowledge" ? <KnowledgePage /> : null}
      {activeTab === "chat" ? <ChatPage /> : null}
      {activeTab === "ops" ? <OpsPage /> : null}
    </Shell>
  );
}

export default App;

