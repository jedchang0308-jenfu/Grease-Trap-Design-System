"use client";

import { useId, useRef, type ReactNode } from "react";

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
  const labelId = useId();
  return (
    <div className="field-label-row">
      <label id={labelId} htmlFor={htmlFor}>
        {label}
      </label>
      <FieldHelpButton ariaLabel={`${label}說明`} help={help} title={label} />
    </div>
  );
}

export function FieldHelpButton({
  ariaLabel,
  help,
  reference,
  showText = true,
  title,
}: {
  ariaLabel: string;
  help: FieldHelpContent;
  reference?: ReactNode;
  showText?: boolean;
  title: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        className={`field-help-trigger${reference ? " has-reference" : ""}`}
        aria-label={reference ? `${ariaLabel}與參考表` : ariaLabel}
        aria-haspopup="dialog"
        title={reference ? `${ariaLabel}與參考表` : ariaLabel}
        onClick={() => dialog.current?.showModal()}
      >
        <span className="field-help-icon" aria-hidden="true">
          ?
        </span>
        {showText ? <span>說明</span> : null}
      </button>
      <dialog
        ref={dialog}
        className={`field-help-dialog${reference ? " has-reference" : ""}`}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={() => dialog.current?.close()}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialog.current?.close();
          }
        }}
      >
        <div className="dialog-body">
          <h2 id={titleId}>
            {title}
            {reference ? "說明與參考表" : "說明"}
          </h2>
          <p id={descriptionId}>{help.description}</p>
          {help.note ? <p className="field-help-note">{help.note}</p> : null}
          {reference ? (
            <div className="field-help-reference">{reference}</div>
          ) : null}
          <div className="button-row end">
            <button
              type="button"
              className="button secondary"
              onClick={() => dialog.current?.close()}
            >
              {reference ? "關閉" : "關閉說明"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
