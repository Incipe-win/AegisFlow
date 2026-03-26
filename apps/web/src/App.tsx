import { useState } from "react";

import { Shell } from "./components/Shell";
import { ChatPage } from "./pages/ChatPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { OpsPage } from "./pages/OpsPage";
import { ToolsPage } from "./pages/ToolsPage";

type TabKey = "knowledge" | "chat" | "ops" | "tools";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("knowledge");

  return (
    <Shell activeTab={activeTab} onTabChange={setActiveTab}>
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Demo Console</p>
          <h2>把 Eino ReAct、Plan-Execute、Multi-Agent、Milvus RAG 和 MCP 串成一条真实主链路</h2>
        </div>
        <div className="hero-metrics">
          <article>
            <strong>Eino</strong>
            <span>ADK Runtime</span>
          </article>
          <article>
            <strong>Milvus</strong>
            <span>Vector Retrieval</span>
          </article>
          <article>
            <strong>MCP</strong>
            <span>Protocol Tools</span>
          </article>
        </div>
      </header>

      {activeTab === "knowledge" ? <KnowledgePage /> : null}
      {activeTab === "chat" ? <ChatPage /> : null}
      {activeTab === "ops" ? <OpsPage /> : null}
      {activeTab === "tools" ? <ToolsPage /> : null}
    </Shell>
  );
}

export default App;
