import React from "react";
import { Modal } from "./Modal";
import { useAppState } from "../state/AppState";

type AccountSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { userEmail } = useAppState();

  return (
    <Modal isOpen={isOpen} title="Account" onClose={onClose}>
      <div className="form">
        <div>
          <p className="section-title">Signed in as</p>
          <p className="helper-text">{userEmail || "Unknown email"}</p>
          <p className="helper-text">
            Sign-in is passwordless. To switch accounts, sign out and request a
            sign-in link for a different email.
          </p>
        </div>
      </div>
    </Modal>
  );
};
