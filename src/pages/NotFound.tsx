import React from "react";
import { Link } from "react-router-dom";

export const NotFound: React.FC = () => (
  <div className="page">
    <div className="card">
      <p className="eyebrow">Page not found</p>
      <h2>That path does not exist.</h2>
      <p className="helper-text">Try a community code instead.</p>
      <div className="cta-row">
        <Link className="button" to="/">
          Go to homepage
        </Link>
      </div>
    </div>
  </div>
);
