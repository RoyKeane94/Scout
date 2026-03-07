import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    document.title = 'Scout';
  }, []);

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-logo">
          SCOUT<span className="landing-logo-dot">.</span>
        </div>

        <p className="landing-tagline">
          Every day your team sees where your brand sits, where competitors are stocked, and what they're doing. None of it gets captured. <span className="landing-tagline-accent">Scout fixes that.</span>
        </p>

        <div className="landing-boxes">
          <div className="landing-box">
            <div className="landing-box-n">01</div>
            <div className="landing-box-title">One subscription</div>
            <div className="landing-box-desc">
              Whole team included. No per-seat pricing.
            </div>
          </div>
          <div className="landing-box">
            <div className="landing-box-n">02</div>
            <div className="landing-box-title">Log in under 30 seconds</div>
            <div className="landing-box-desc">
              Brand, venue, placement, price. Done before the next sip.
            </div>
          </div>
          <div className="landing-box">
            <div className="landing-box-n">03</div>
            <div className="landing-box-title">Know your competition</div>
            <div className="landing-box-desc">
              Where they're stocked, what they're charging, which venues to target next.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
