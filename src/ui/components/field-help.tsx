"use client";

import { useId, useRef } from "react";

export interface FieldHelpContent {
  description: string;
  note?: string;
}

export function FieldLabelHelp({
  htmlFor,
  label,
  help,
}: {
  htmlFor: string;
  label: string;
  help: FieldHelpContent;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="field-label-row">
      <label htmlFor={htmlFor}>{label}</label>
      <button
        type="button"
        className="field-help-trigger"
        aria-label={`${label}說明`}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <span className="field-help-icon" aria-hidden="true">
          ?
        </span>
        <span>說明</span>
      </button>
      <dialog
        ref={dialog}
        className="field-help-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={() => dialog.current?.close()}
      >
        <div className="dialog-body">
          <h2 id={titleId}>{label}說明</h2>
          <p id={descriptionId}>{help.description}</p>
          {help.note ? <p className="field-help-note">{help.note}</p> : null}
          <div className="button-row end">
            <button
              type="button"
              className="button secondary"
              onClick={() => dialog.current?.close()}
            >
              關閉說明
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
