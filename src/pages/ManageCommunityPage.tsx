import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type ManageCommunityPageProps = {
  onOpenAuth: () => void;
};

export const ManageCommunityPage: React.FC<ManageCommunityPageProps> = ({ onOpenAuth }) => {
  const params = useParams();
  const navigate = useNavigate();
  const rawCode = params.code ?? "";
  const communityCode = toCommunitySlug(rawCode) || rawCode;
  const displayCode = rawCode.trim() || communityCode || "unknown";
  const {
    signedIn,
    updateCommunity,
    addAdmin,
    deleteCommunity,
    getCommunityAdmins,
    getCommunity,
    isAdminFor,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();

  const community = getCommunity(communityCode);
  const communityLoaded = isCommunityLoaded(communityCode);
  const isAdmin = signedIn && isAdminFor(communityCode);

  const [content, setContent] = useState(community?.content ?? "");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminError, setAdminError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return subscribeCommunity(communityCode);
  }, [communityCode, subscribeCommunity]);

  useEffect(() => {
    if (!community) return;
    setContent(community.content);
    setAdminError("");
    setSaved(false);
  }, [community?.code]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!community && !communityLoaded) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Loading</p>
          <h2>Fetching block details...</h2>
          <p className="helper-text">Hang tight while we pull the latest info.</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="page">
        <div className="card">
          <p className="eyebrow">Block not found</p>
          <h2>
            Block <code>{displayCode}</code> does not exist - check your
            spelling or check again with your neighbor!
          </h2>
          <p className="helper-text">
            Block pages are private. Double check the code with your
            neighbor.
          </p>
          <div className="cta-row">
            <Link className="button" to="/">
              Return home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const adminEmails = getCommunityAdmins(community.code);
  const hasChanges = content !== community.content;

  const handleSave = async () => {
    if (!community || saving) return;
    setSaving(true);
    await updateCommunity(community.code, { content });
    setSaving(false);
    setSaved(true);
  };

  const handleAddAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminEmail.trim() || !community) return;
    const error = await addAdmin(community.code, adminEmail.trim());
    if (error) {
      setAdminError(error);
      return;
    }
    setAdminEmail("");
    setAdminError("");
  };

  const handleDelete = async () => {
    if (!community) return;
    setDeleting(true);
    await deleteCommunity(community.code);
    setDeleting(false);
    setShowDeleteConfirm(false);
    navigate("/", { replace: true });
  };

  if (!isAdmin) {
    return (
      <div className="page manage-page">
        <section className="community-header">
          <div>
          <p className="eyebrow">Manage block</p>
          <h1>{community.name}</h1>
          <p className="lead">Code {community.code}</p>
        </div>
        <div className="action-stack">
          <Link className="button ghost" to={`/${community.code}`}>
            Back to block page
          </Link>
        </div>
      </section>
      <div className="card warning-card">
        <p className="eyebrow">Admin access</p>
        <h3>Only admins can manage this block.</h3>
        <p className="helper-text">
          Sign in with an admin account to edit content or add organizers.
        </p>
        <div className="cta-row">
            {!signedIn ? (
              <button className="button" onClick={onOpenAuth}>
                Sign in
              </button>
            ) : null}
            <Link className="button ghost" to={`/${community.code}`}>
              Back to block page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page manage-page">
      <section className="manage-header">
        <div>
          <p className="eyebrow">Manage block</p>
          <h1>{community.name}</h1>
          <p className="lead">Code {community.code}</p>
        </div>
        <div className="manage-actions">
          {saved ? <span className="manage-status">Saved</span> : null}
          {hasChanges && !saved ? (
            <span className="manage-status">Unsaved changes</span>
          ) : null}
          <Link className="button ghost" to={`/${community.code}`}>
            Back to block page
          </Link>
          <button
            className="button"
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      <section className="manage-grid">
        <div className="card manage-editor">
          <div>
            <p className="section-title">Block content (markdown)</p>
            <p className="helper-text">This content appears on the block page.</p>
          </div>
          <textarea
            className="manage-textarea"
            aria-label="Community content markdown"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              if (saved) setSaved(false);
            }}
          />
        </div>
        <div className="card manage-preview">
          <p className="section-title">Live preview</p>
          <div className="preview-card">
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || "_No content yet_"}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </section>

      <section className="manage-lower">
        <div className="card">
          <p className="section-title">Admins</p>
          <ul className="admin-list">
            {adminEmails.length ? (
              adminEmails.map((admin) => <li key={admin}>{admin}</li>)
            ) : (
              <li>Only you (for now)</li>
            )}
          </ul>
          <form className="inline-form" onSubmit={handleAddAdmin}>
            <input
              value={adminEmail}
              onChange={(event) => {
                setAdminEmail(event.target.value);
                if (adminError) setAdminError("");
              }}
              placeholder="new-admin@email.com"
              type="email"
            />
            <button className="button ghost" type="submit">
              Add admin
            </button>
          </form>
          {adminError ? <p className="helper-text error-text">{adminError}</p> : null}
        </div>
        <div className="card manage-danger">
          <p className="section-title">Danger zone</p>
          <p className="helper-text">
            Deleting a block permanently removes its content and admin list.
          </p>
          <button
            className="button ghost danger"
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete block
          </button>
        </div>
      </section>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete this block?"
        description={`This permanently removes ${community.name} and its content.`}
        confirmLabel={deleting ? "Deleting..." : "Delete block"}
        destructive
        confirmDisabled={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
