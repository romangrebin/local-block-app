import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAppState } from "../state/AppState";
import { AuthMode } from "../data/types";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, requestPasswordReset } = useAppState();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode("signin");
      setEmail("");
      setPassword("");
      setError("");
      setInfo("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setInfo("");
    const message = await signIn({ email, password, mode });
    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }
    onClose();
  };

  const handleForgotPassword = async () => {
    if (submitting) return;
    setError("");
    setInfo("");
    setSubmitting(true);
    const message = await requestPasswordReset(email);
    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }
    setInfo("If an account exists for this email, a reset link has been sent.");
    setSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      title={mode === "signin" ? "Welcome back" : "Join your block"}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button className="button" type="submit" form="auth-form" disabled={submitting}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>
      }
    >
      <div className="toggle">
        <button
          type="button"
          className={mode === "signin" ? "toggle-active" : ""}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === "signup" ? "toggle-active" : ""}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>
      <form id="auth-form" className="form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="alex@localblock.org"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>
        {mode === "signin" ? (
          <div className="inline-actions">
            <button
              type="button"
              className="button ghost"
              onClick={handleForgotPassword}
              disabled={submitting}
            >
              Forgot password?
            </button>
          </div>
        ) : null}
        {error ? <p className="helper-text error-text">{error}</p> : null}
        {info ? <p className="helper-text">{info}</p> : null}
        <p className="helper-text">
          {mode === "signin"
            ? "Sign in with your email and password."
            : "Create an account to request membership or manage a community."}
        </p>
      </form>
    </Modal>
  );
};
