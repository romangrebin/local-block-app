import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppState } from "../state/AppState";
import { toCommunitySlug } from "../data/normalize";

type HomePageProps = {
  onOpenAuth: () => void;
  onOpenCreate: () => void;
};

export const HomePage: React.FC<HomePageProps> = ({ onOpenAuth, onOpenCreate }) => {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  const {
    signedIn,
    adminCommunityCode,
    getCommunity,
    subscribeCommunity,
    isCommunityLoaded,
    firebaseEnabled,
  } = useAppState();
  const adminCommunity = adminCommunityCode ? getCommunity(adminCommunityCode) : null;

  useEffect(() => {
    if (!adminCommunityCode) return;
    return subscribeCommunity(adminCommunityCode);
  }, [adminCommunityCode, subscribeCommunity]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const slug = toCommunitySlug(code);
    if (!slug) return;
    navigate(`/${slug}`);
  };

  const renderCta = () => {
    if (!signedIn) {
      return (
        <button className="button ghost" onClick={onOpenAuth}>
          Sign in to create a community
        </button>
      );
    }

    if (adminCommunityCode && !isCommunityLoaded(adminCommunityCode)) {
      return (
        <button className="button ghost" type="button" disabled>
          Loading your block...
        </button>
      );
    }

    if (adminCommunityCode) {
      return (
        <Link className="button ghost" to={`/${adminCommunityCode}`}>
          Open {adminCommunity?.name ?? "your block"}
        </Link>
      );
    }

    return (
      <button className="button ghost" onClick={onOpenCreate}>
        Create a block
      </button>
    );
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Your block's private landing page</h1>
          <p className="lead">
            Use a code to open your block page with chats, events, and organizer info.
          </p>
          <ul className="flow-list">
            <li>
              <strong>Have a code?</strong> Enter it below. No sign-in needed.
            </li>
            <li>
              <strong>Need a code?</strong> Ask a neighbor, or sign in to create a community.
            </li>
          </ul>
          <form className="code-form" onSubmit={handleSubmit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter block code"
              aria-label="Block code"
            />
            <button className="button" type="submit">
              Open block page
            </button>
          </form>
          <p className="helper-text">
            Codes are shared neighbor-to-neighbor and are not listed or searchable.
          </p>
        </div>
        <div className="card showcase">
          {!firebaseEnabled ? (
            <>
              <h3>Demo blocks</h3>
              <p>Use these sample codes to preview a block page.</p>
              <div className="pill-row">
                <Link className="pill" to="/maple-hill">
                  maple-hill
                </Link>
                <Link className="pill" to="/citrus-park">
                  citrus-park
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3>Need a code?</h3>
              <p>
                Ask a neighbor for your block's code, or sign in to create a community and get
                one.
              </p>
            </>
          )}
          <div className="cta-row">{renderCta()}</div>
        </div>
      </section>
    </div>
  );
};
