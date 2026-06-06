import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle, FileCode, Pencil, Eye } from "lucide-react";
import type { GeneratedResources } from "@/lib/types";

export function Step5Preview({
  resources,
  isLoading,
  error,
  editedManifest,
  editedCICD,
  onManifestChange,
  onCICDChange,
}: {
  resources: GeneratedResources | null;
  isLoading: boolean;
  error: string | null;
  editedManifest: string;
  editedCICD: string;
  onManifestChange: (v: string) => void;
  onCICDChange: (v: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"runtime" | "cicd">("runtime");
  const [editingTab, setEditingTab] = useState<"runtime" | "cicd" | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating resources…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
        <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-destructive">Generation failed</div>
          <div className="text-xs text-destructive/80 mt-0.5">{error}</div>
        </div>
      </div>
    );
  }

  if (!resources) return null;

  const tabs: { key: "runtime" | "cicd"; label: string }[] = [
    { key: "runtime", label: `${resources.runtime_provider} manifest` },
  ];
  if (resources.cicd_workflow) {
    tabs.push({ key: "cicd", label: `${resources.cicd_provider ?? "CI/CD"} workflow` });
  }

  const isEditing = editingTab === activeTab;
  const currentContent = activeTab === "runtime" ? editedManifest : editedCICD;
  const originalContent =
    activeTab === "runtime" ? (resources.runtime_manifest ?? "") : (resources.cicd_workflow ?? "");
  const isDirty = currentContent !== originalContent;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-emerald-600">
        <CheckCircle className="size-4 shrink-0" />
        <span className="text-xs font-medium">
          Resources generated. Review and edit before provisioning.
        </span>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex gap-1 flex-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                setEditingTab(null);
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              <FileCode className="size-3 inline mr-1" />
              {t.label}
              {activeTab === t.key && isDirty && (
                <span className="ml-1.5 size-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setEditingTab(isEditing ? null : activeTab)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition ${
            isEditing
              ? "bg-amber-500/15 text-amber-600 hover:bg-amber-500/25"
              : "bg-secondary text-muted-foreground hover:bg-accent"
          }`}
          title={isEditing ? "Done editing" : "Edit pipeline"}
        >
          {isEditing ? <Eye className="size-3" /> : <Pencil className="size-3" />}
          {isEditing ? "Preview" : "Edit"}
        </button>

        {isDirty && (
          <button
            onClick={() => {
              if (activeTab === "runtime") onManifestChange(originalContent);
              else onCICDChange(originalContent);
            }}
            className="px-2.5 py-1.5 rounded text-xs font-medium bg-secondary text-muted-foreground hover:bg-accent transition"
            title="Revert to generated"
          >
            Revert
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea
          value={currentContent}
          onChange={(e) => {
            if (activeTab === "runtime") onManifestChange(e.target.value);
            else onCICDChange(e.target.value);
          }}
          spellCheck={false}
          className="w-full h-80 px-4 py-3 rounded-md bg-secondary border border-amber-500/50 outline-none resize-none text-xs font-mono leading-relaxed focus:border-primary transition"
        />
      ) : (
        <div className="rounded-md bg-secondary border border-border overflow-auto max-h-80">
          <pre className="p-4 text-xs font-mono whitespace-pre leading-relaxed">
            {currentContent}
          </pre>
        </div>
      )}

      {isDirty && !isEditing && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <Pencil className="size-3" />
          This file has been edited. The modified version will be provisioned.
        </p>
      )}
    </div>
  );
}
