// Puts the open workflow's name into workflow.extra.workflow_name right before
// the prompt is queued, so the server-side handler can read it.
//
// Verified against ComfyUI frontend 1.59.11 (headless ComfyUI + real UI):
//   app.extensionManager.workflow.activeWorkflow is the active workflow, with
//     path         "workflows/portraits/studio-v2.json"  (keeps subfolders)
//     fullFilename "studio-v2.json"                      (drops subfolders)
//   Unsaved workflows are still named, e.g. "workflows/Unsaved Workflow.json".
// api.queuePrompt wrapping is not a documented extension point, so it is the
// part most likely to break on a future frontend.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function currentWorkflowName() {
  try {
    const wf = app.extensionManager?.workflow?.activeWorkflow;
    // Prefer `path` so subfolders survive; it is relative to user/ and starts
    // with "workflows/". Fall back to the bare filename on other versions.
    if (typeof wf?.path === "string" && wf.path) {
      return wf.path.replace(/^workflows\//, "");
    }
    return wf?.fullFilename ?? wf?.filename ?? "";
  } catch (e) {
    return "";
  }
}

app.registerExtension({
  name: "creature_sorter",
  async setup() {
    const original = api.queuePrompt.bind(api);
    api.queuePrompt = async function (number, data, options) {
      try {
        const name = currentWorkflowName();
        if (name && data?.workflow) {
          data.workflow.extra = { ...(data.workflow.extra ?? {}), workflow_name: name };
        }
      } catch (e) {
        console.warn("creature_sorter:", e);
      }
      return original(number, data, options);
    };
  },
});
