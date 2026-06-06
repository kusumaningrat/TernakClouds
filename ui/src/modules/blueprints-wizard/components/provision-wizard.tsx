import { useState } from "react";
import { Loader2, ArrowLeft, ArrowRight, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import type { Blueprint, PlatformSpec, GeneratedResources, RepositoryProvisionConfig } from "@/lib/types";
import { usePreviewApp, useProvisionApp } from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BlueprintIcon } from "../utils/icons";
import { buildDefaultSpec, loadDraft, saveDraft, clearDraft } from "../utils/spec";
import type { WizardDraft } from "../utils/spec";
import { StepIndicator } from "./step-indicator";
import { Step1Runtime } from "./steps/step1-runtime";
import { Step2RuntimeConfig } from "./steps/step2-runtime-config";
import { Step3Container } from "./steps/step3-container";
import { Step4SecretsCICD } from "./steps/step4-secrets-cicd";
import { Step5Preview } from "./steps/step5-preview";

export function ProvisionWizard({
  open,
  blueprint,
  onClose,
  workspaceSlug,
  envSlug,
}: {
  open: boolean;
  blueprint: Blueprint | null;
  onClose: () => void;
  workspaceSlug: string;
  envSlug: string;
}) {
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<PlatformSpec | null>(null);
  const [preview, setPreview] = useState<GeneratedResources | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [editedManifest, setEditedManifest] = useState("");
  const [editedCICD, setEditedCICD] = useState("");
  const [grantId, setGrantId] = useState("");
  const [initialSecretsRaw, setInitialSecretsRaw] = useState("");
  const [repoConfig, setRepoConfig] = useState<RepositoryProvisionConfig | null>(null);
  const [buildContext, setBuildContext] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const previewMutation = usePreviewApp(workspaceSlug, envSlug);
  const provisionMutation = useProvisionApp(workspaceSlug, envSlug);

  const parseSecrets = (raw: string): Record<string, string> => {
    const result: Record<string, string> = {};
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) return;
      result[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1);
    });
    return result;
  };

  const patchSpec = (patch: Partial<PlatformSpec>) =>
    setSpec((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleOpen = (bp: Blueprint) => {
    const draft = loadDraft(envSlug, bp.name);
    if (draft) {
      setSpec(draft.spec);
      setStep(draft.step);
      setGrantId(draft.grantId);
      setInitialSecretsRaw(draft.initialSecretsRaw);
      setRepoConfig(draft.repoConfig);
      setBuildContext(draft.buildContext);
      setIsDraftLoaded(true);
    } else {
      const defaultRuntime = bp.supported_runtimes[0] ?? "nomad";
      setSpec(buildDefaultSpec(bp, defaultRuntime));
      setStep(0);
      setGrantId("");
      setInitialSecretsRaw("");
      setRepoConfig(null);
      setBuildContext("");
      setIsDraftLoaded(false);
    }
    setPreview(null);
    setPreviewError(null);
  };

  if (blueprint && spec && spec.service.type !== blueprint.name) {
    handleOpen(blueprint);
  }

  const canNext = () => {
    if (!spec || !blueprint) return false;
    if (step === 0) return spec.service.name.trim() !== "" && !!spec.runtime.provider;
    if (step === 1) {
      if (spec.runtime.provider === "nomad")
        return !!spec.runtime.datacenter && !!spec.runtime.worker_name;
      return true;
    }
    if (step === 2) return spec.container.image.trim() !== "" && spec.container.port > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 3) {
      if (!blueprint || !spec) return;
      setPreview(null);
      setPreviewError(null);
      setStep(4);
      try {
        const res = await previewMutation.mutateAsync({ blueprint_name: blueprint.name, spec });
        setPreview(res);
        setEditedManifest(res.runtime_manifest ?? "");
        setEditedCICD(res.cicd_workflow ?? "");
      } catch (err: unknown) {
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleProvision = async () => {
    if (!blueprint || !spec) return;
    try {
      const overrideManifest =
        editedManifest !== (preview?.runtime_manifest ?? "") ? editedManifest : undefined;
      const overrideCICD = editedCICD !== (preview?.cicd_workflow ?? "") ? editedCICD : undefined;
      const parsedSecrets = parseSecrets(initialSecretsRaw);
      const result = await provisionMutation.mutateAsync({
        blueprint_name: blueprint.name,
        spec,
        override_manifest: overrideManifest,
        override_cicd: overrideCICD,
        repository: repoConfig?.provider_id && repoConfig?.repository ? repoConfig : undefined,
        initial_secrets: Object.keys(parsedSecrets).length > 0 ? parsedSecrets : undefined,
        secret_grant_id: grantId || undefined,
      });

      if (result.pr_url) {
        toast.success(`${spec.service.name} provisioned`, {
          description: `Runtime: ${spec.runtime.provider} · PR #${result.pr_number} opened in ${result.repo_name ?? repoConfig?.repository ?? ""}`,
        });
      } else {
        toast.success(`${spec.service.name} provisioned`, {
          description: `Blueprint: ${blueprint.display_name} · Runtime: ${spec.runtime.provider}`,
        });
      }

      if (repoConfig?.repository && result.repo_error) {
        toast.warning("Repository commit failed", { description: result.repo_error });
      }

      clearDraft(envSlug, blueprint.name);
      resetWizard();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Provision failed";
      toast.error(msg);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setSpec(null);
    setPreview(null);
    setPreviewError(null);
    setEditedManifest("");
    setEditedCICD("");
    setGrantId("");
    setInitialSecretsRaw("");
    setRepoConfig(null);
    setBuildContext("");
    setIsDraftLoaded(false);
  };

  const handleClose = () => {
    if (spec && blueprint && (step > 0 || spec.service.name.trim() !== "")) {
      const draft: WizardDraft = { step, spec, grantId, initialSecretsRaw, repoConfig, buildContext };
      saveDraft(envSlug, blueprint.name, draft);
    }
    resetWizard();
    onClose();
  };

  const handleDiscardDraft = () => {
    if (!blueprint) return;
    clearDraft(envSlug, blueprint.name);
    const defaultRuntime = blueprint.supported_runtimes[0] ?? "nomad";
    setSpec(buildDefaultSpec(blueprint, defaultRuntime));
    setStep(0);
    setGrantId("");
    setInitialSecretsRaw("");
    setRepoConfig(null);
    setBuildContext("");
    setIsDraftLoaded(false);
  };

  if (!blueprint) return null;

  if (!spec) {
    handleOpen(blueprint);
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BlueprintIcon icon={blueprint.icon} className="size-4 text-muted-foreground" />
            Provision {blueprint.display_name}
            {isDraftLoaded && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 font-medium">
                  draft restored
                </span>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="text-[11px] text-muted-foreground hover:text-destructive transition underline underline-offset-2"
                >
                  Discard
                </button>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <StepIndicator current={step} />

          <div className="mt-2">
            {step === 0 && <Step1Runtime bp={blueprint} spec={spec} onChange={patchSpec} />}
            {step === 1 && (
              <Step2RuntimeConfig
                spec={spec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
                onChange={patchSpec}
              />
            )}
            {step === 2 && (
              <Step3Container
                spec={spec}
                onChange={patchSpec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
              />
            )}
            {step === 3 && (
              <Step4SecretsCICD
                spec={spec}
                onChange={patchSpec}
                workspaceSlug={workspaceSlug}
                envSlug={envSlug}
                onGrantIdChange={setGrantId}
                initialSecretsRaw={initialSecretsRaw}
                onInitialSecretsChange={setInitialSecretsRaw}
                repoConfig={repoConfig}
                onRepoConfigChange={setRepoConfig}
                buildContext={buildContext}
                onBuildContextChange={(v) => {
                  setBuildContext(v);
                  patchSpec({ cicd: { ...spec.cicd, build_context: v || undefined } });
                }}
              />
            )}
            {step === 4 && (
              <Step5Preview
                resources={preview}
                isLoading={previewMutation.isPending}
                error={previewError}
                editedManifest={editedManifest}
                editedCICD={editedCICD}
                onManifestChange={setEditedManifest}
                onCICDChange={setEditedCICD}
              />
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  {[
                    ["Application", spec.service.name],
                    ["Blueprint", blueprint.display_name],
                    ["Runtime", spec.runtime.provider],
                    ["Image", `${spec.container.image}:${spec.container.tag}`],
                    ["Strategy", spec.deployment.strategy],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">{k}</span>
                      <span className="font-mono text-xs">{v}</span>
                    </div>
                  ))}
                  {repoConfig?.repository && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">PR target</span>
                      <span className="font-mono text-xs">
                        {repoConfig.repository} /{" "}
                        <span className="text-primary">{repoConfig.base_branch || "main"}</span>
                      </span>
                    </div>
                  )}
                  {buildContext && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        Build context
                      </span>
                      <span className="font-mono text-xs">./{buildContext}</span>
                    </div>
                  )}
                  {Object.keys(parseSecrets(initialSecretsRaw)).length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-28 shrink-0 text-xs">
                        Vault write
                      </span>
                      <span className="font-mono text-xs">
                        {Object.keys(parseSecrets(initialSecretsRaw)).length} key
                        {Object.keys(parseSecrets(initialSecretsRaw)).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  The platform will generate the runtime manifest and submit it to{" "}
                  <strong>{spec.runtime.provider}</strong>.
                  {repoConfig?.repository &&
                    " A pull request will be opened with the generated manifests."}{" "}
                  This action cannot be automatically undone.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border mt-2">
          <button
            type="button"
            onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-secondary hover:bg-accent text-sm transition"
          >
            {step === 0 ? <X className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canNext() || previewMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
              {step === 3 ? "Generate Preview" : "Next"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleProvision()}
              disabled={provisionMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {provisionMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )}
              Provision
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
