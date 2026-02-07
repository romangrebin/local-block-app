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
    memberCommunityCode,
    pendingCommunityCode,
    getCommunity,
    subscribeCommunity,
    isCommunityLoaded,
  } = useAppState();
  const memberCommunity = memberCommunityCode ? getCommunity(memberCommunityCode) : null;
  const pendingCommunity = pendingCommunityCode ? getCommunity(pendingCommunityCode) : null;
  const hasMemberCommunity = Boolean(memberCommunityCode);
  const hasPendingCommunity = Boolean(pendingCommunityCode);
  const isBlocked = hasMemberCommunity || hasPendingCommunity;

  useEffect(() => {
    if (!memberCommunityCode) return;
    return subscribeCommunity(memberCommunityCode);
  }, [memberCommunityCode, subscribeCommunity]);

  useEffect(() => {
    if (!pendingCommunityCode) return;
    return subscribeCommunity(pendingCommunityCode);
  }, [pendingCommunityCode, subscribeCommunity]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const slug = toCommunitySlug(code);
    if (!slug) return;
    navigate(`/${slug}`);
  };

  const renderCta = () => {
    if (isBlocked) return null;
    if (!signedIn) {
      return (
        <button className="button ghost" onClick={onOpenAuth}>
          Sign in to create a community
        </button>
      );
    }

    if (memberCommunityCode && !isCommunityLoaded(memberCommunityCode)) {
      return (
        <button className="button ghost" type="button" disabled>
          Loading your block...
        </button>
      );
    }

    return (
      <button className="button ghost" onClick={onOpenCreate}>
        Create a block
      </button>
    );
  };

  const cta = renderCta();

  return (
    <div className="page home-page">
      <section className="hero hero-home">
        <div className="hero-copy">
          <h1>Your block's private landing page</h1>
          <p className="lead">
            Use a code to open your block page and connect with your neighbors.
          </p>
          {hasMemberCommunity ? (
            <div className="home-primary-cta">
              <div>
                <p className="eyebrow">Your block</p>
                <p className="lead">
                  Jump back into{" "}
                  <strong>{memberCommunity?.name ?? "your block"}</strong>.
                </p>
              </div>
              <Link className="button" to={`/${memberCommunityCode}`}>
                Open {memberCommunityCode}
              </Link>
            </div>
          ) : null}
          {!hasMemberCommunity && hasPendingCommunity ? (
            <div className="home-primary-cta">
              <div>
                <p className="eyebrow">Request pending</p>
                <p className="lead">
                  Waiting on approval for{" "}
                  <strong>{pendingCommunity?.name ?? pendingCommunityCode}</strong>.
                </p>
              </div>
              <Link className="button" to={`/${pendingCommunityCode}`}>
                View {pendingCommunityCode}
              </Link>
            </div>
          ) : null}
          <form className="code-form code-form-home" onSubmit={handleSubmit}>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={hasMemberCommunity ? "Open another block code" : "Enter block code"}
              aria-label="Block code"
            />
            <button className="button" type="submit">
              {hasMemberCommunity ? "Open another block" : "Open block page"}
            </button>
          </form>
          <div className="home-actions">
            <p className="helper-text">
              Codes are shared neighbor-to-neighbor and are not listed or searchable. Ask a neighbor for your block's code, or sign in to create a community.
            </p>
            {cta ? <div className="cta-row">{cta}</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
};
