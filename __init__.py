"""workflow_output_sorter

Rewrites every Save node's `filename_prefix` at queue time so outputs land in

    output/<workflow_name>/<YYMMDD>/<original prefix>

STATUS: the handler logic was run against a stub PromptServer only. It has NOT been
run inside a live ComfyUI. The frontend half (js/workflow_name.js) is untested.

How it works
- js/workflow_name.js (frontend) writes the open workflow's name into
  workflow.extra.workflow_name before the prompt is queued.
- on_prompt (here) runs inside POST /prompt, reads that name from
  extra_data.extra_pnginfo.workflow.extra.workflow_name, and prefixes every
  string `filename_prefix` in the prompt. API clients can skip the frontend and
  send extra_data.workflow_name themselves.
- Linked prefixes (a node output wired into filename_prefix) are lists in the
  prompt dict and are skipped. Savers that use another input name are not touched.
- ComfyUI only logs exceptions raised by prompt handlers, so a failure here
  means files silently land in the default folder. Check the console log.
"""
import datetime
import logging
import re

from server import PromptServer

log = logging.getLogger("workflow_output_sorter")

WEB_DIRECTORY = "./js"
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]


def _segment(text):
    """One safe folder-name segment."""
    seg = re.sub(r"[^\w\-. ]+", "_", str(text)).strip(" .")
    return seg if seg not in ("", ".", "..") else "unsorted"


def _workflow_folder(json_data):
    extra = json_data.get("extra_data") or {}
    name = extra.get("workflow_name")  # API clients can send this directly
    if not name:
        workflow = (extra.get("extra_pnginfo") or {}).get("workflow") or {}
        name = (workflow.get("extra") or {}).get("workflow_name")
    if not name:
        return "unsaved"
    name = re.sub(r"\.json$", "", str(name), flags=re.IGNORECASE)
    parts = [p for p in re.split(r"[\\/]+", name) if p]
    return "/".join(_segment(p) for p in parts) or "unsaved"


def on_prompt(json_data):
    try:
        # Date is the queue time on the server's clock, not the run time.
        folder = f"{_workflow_folder(json_data)}/{datetime.datetime.now():%y%m%d}"
        for node in (json_data.get("prompt") or {}).values():
            inputs = node.get("inputs") if isinstance(node, dict) else None
            if not inputs:
                continue
            prefix = inputs.get("filename_prefix")
            if isinstance(prefix, str) and not prefix.startswith(folder + "/"):
                inputs["filename_prefix"] = f"{folder}/{prefix}"
    except Exception:
        log.exception("workflow_output_sorter failed; prompt left unchanged")
    return json_data


PromptServer.instance.add_on_prompt_handler(on_prompt)
