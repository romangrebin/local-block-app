import React, { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { ConfirmModal } from "./ConfirmModal";
import { Community } from "../data/models";
import { useAppState } from "../state/AppState";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ManageCommunityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  community: Community | null;
  onDeleted: () => void;
};

export const ManageCommunityModal: React.FC<ManageCommunityModalProps> = ({
  isOpen,
  onClose,
  community,
  onDeleted,
}) => {
  const { updateCommunity, addAdmin, deleteCommunity } = useAppState();
  const [content, setContent] = useState(community?.content ?? "");
  const [adminEmail, setAdminEmail] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (community && isOpen) {
      setContent(community.content);
    }
  }, [community, isOpen]);

  if (!community) return null;

  const handleSave = async () => {
    await updateCommunity(community.code, { content });
    onClose();
  };

  const handleAddAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminEmail.trim()) return;
    await addAdmin(community.code, adminEmail.trim());
    setAdminEmail("");
  };

  const handleDelete = async () => {
    setDeleting(true);
    await deleteCommunity(community.code);
    setDeleting(false);
    setShowDeleteConfirm(false);
    onDeleted();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={`Manage ${community.name}`}
        onClose={onClose}
        footer={
        <div className="modal-actions spaced">
          <button
            className="button ghost danger"
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete community
          </button>
          <button className="button" type="button" onClick={handleSave}>
            Save changes
          </button>
        </div>
      }
    >
      <div className="editor-grid">
        <div className="form">
          <label>
            Community content (markdown)
            <textarea
              rows={10}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
        </div>
        <div className="preview-pane">
          <p className="section-title">Live preview</p>
          <div className="preview-card">
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || "_No content yet_"}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
      <div className="divider" />
      <div className="form">
        <p className="section-title">Admins</p>
        <ul className="admin-list">
          {community.admins.length ? (
            community.admins.map((admin) => <li key={admin}>{admin}</li>)
          ) : (
            <li>Only you (for now)</li>
          )}
        </ul>
        <form className="inline-form" onSubmit={handleAddAdmin}>
          <input
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            placeholder="new-admin@email.com"
            type="email"
          />
          <button className="button ghost" type="submit">
            Add admin
          </button>
        </form>
      </div>
      </Modal>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete this community?"
        description={`This permanently removes ${community.name} and its content.`}
        confirmLabel={deleting ? "Deleting..." : "Delete community"}
        destructive
        confirmDisabled={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  );
};
