// UNTESTED. Puts the open workflow's name into workflow.extra.workflow_name
// right before the prompt is queued, so the server-side handler can read it.
//
// Assumptions to check in the browser console on your frontend version:
//   app.extensionManager.workflow.activeWorkflow   -> has the saved name
//   (the name property is unverified: fullFilename / filename / path are tried)
// api.queuePrompt wrapping is the fragile part. The docs page on hijacking
// calls monkey-patching `app` functions deprecated; it does not mention
// api.queuePrompt, and no documented queue-time hook was found.
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function currentWorkflowName() {
  try {
    const wf = app.extensionManager?.workflow?.activeWorkflow;
    return wf?.fullFilename ?? wf?.filename ?? wf?.path ?? "";
  } catch (e) {
    return "";
  }
}

app.registerExtension({
  name: "workflow_output_sorter",
  async setup() {
    const original = api.queuePrompt.bind(api);
    api.queuePrompt = async function (number, data, options) {
      try {
        const name = currentWorkflowName();
        if (name && data?.workflow) {
          data.workflow.extra = { ...(data.workflow.extra ?? {}), workflow_name: name };
        }
      } catch (e) {
        console.warn("workflow_output_sorter:", e);
      }
      return original(number, data, options);
    };
  },
});
