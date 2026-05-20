import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAppState } from "../state/AppState";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn } = useAppState();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setError("");
      setSent(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const message = await signIn({ email });
    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }
    setSent(true);
    setSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      title={sent ? "Check your email" : "Sign in to your block"}
      onClose={onClose}
      footer={
        sent ? (
          <div className="modal-actions">
            <button className="button" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="button" type="submit" form="auth-form" disabled={submitting}>
              {submitting ? "Sending…" : "Email me a sign-in link"}
            </button>
          </div>
        )
      }
    >
      {sent ? (
        <p className="helper-text">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device
          to finish signing in. The link works once and expires after about an hour.
        </p>
      ) : (
        <form id="auth-form" className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alex@localblock.org"
              required
              autoFocus
            />
          </label>
          {error ? <p className="helper-text error-text">{error}</p> : null}
          <p className="helper-text">
            No password needed. We'll email you a one-tap sign-in link. New here? The
            same link creates your account.
          </p>
        </form>
      )}
    </Modal>
  );
};
