import React from "react";
import { Modal } from "./Modal";

type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    isOpen={isOpen}
    title={title}
    onClose={onCancel}
    footer={
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          className={`button${destructive ? " danger" : ""}`}
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    }
  >
    <p className="helper-text">{description}</p>
  </Modal>
);
