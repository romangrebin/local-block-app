import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "./Modal";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type CreateCommunityModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { createCommunity, memberCommunityCode, getCommunity } = useAppState();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const sanitizedCode = useMemo(() => toCommunitySlug(code), [code]);
  const isBlocked = Boolean(memberCommunityCode);
  const existingCommunity = sanitizedCode ? getCommunity(sanitizedCode) : null;
  const hasInvalidChars = Boolean(code) && sanitizedCode !== code;
  const canCreate = !isBlocked && !existingCommunity && !hasInvalidChars;

  useEffect(() => {
    if (isOpen) {
      setName("");
      setCode("");
      setContent("");
      setError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBlocked) return;
    setSubmitting(true);
    setError("");
    const createdCode = await createCommunity({
      code: sanitizedCode,
      name,
      content,
    });
    if (createdCode) {
      onClose();
      navigate(`/${createdCode}`);
      return;
    }
    setError("Unable to create that block. Try a different code.");
    setSubmitting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Create a block"
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button
            className="button"
            type="submit"
            form="create-community-form"
            disabled={!sanitizedCode || !canCreate || submitting}
          >
            Create block
          </button>
        </div>
      }
    >
      <form id="create-community-form" className="form" onSubmit={handleSubmit}>
        <label>
          Block name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Maple Hill"
            required
          />
        </label>
        <label>
          Block code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="maple-hill"
            required
          />
          <span className="helper-text">
            Neighbors will need this code to visit the private block page.
          </span>
          <span className="helper-text">
            Use 8+ characters to make codes harder to guess.
          </span>
          {sanitizedCode && sanitizedCode !== code ? (
            <span className="helper-text">
              Only lowercase letters, numbers, and hyphens allowed. Use{" "}
              {sanitizedCode}.
            </span>
          ) : null}
          {existingCommunity ? (
            <span className="helper-text">That code is already in use.</span>
          ) : null}
        </label>
        <label>
          Starter content (markdown)
          <textarea
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="## Welcome!\n\nShare links, events, and organizer contacts."
          />
        </label>
        {error ? <p className="helper-text error-text">{error}</p> : null}
        {isBlocked ? (
          <p className="helper-text">You already belong to a block.</p>
        ) : null}
      </form>
    </Modal>
  );
};
