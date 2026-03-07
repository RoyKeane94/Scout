import { useEffect } from 'react';

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy policy — Scout';
  }, []);

  return (
    <div className="page privacy-page">
      <div className="privacy-inner">
        <h1 className="privacy-title">Privacy policy</h1>
        <p className="privacy-updated">Last updated: 2026</p>

        <section className="privacy-section">
          <h2>What we collect</h2>
          <p>
            We collect the information you provide when you use Scout: account details (name, email, password), 
            the sightings you log (brand, venue, placement, price, photos), and how you use the product.
          </p>
        </section>

        <section className="privacy-section">
          <h2>How we use it</h2>
          <p>
            We use this information to run Scout, to improve the service, and to show you and your team 
            the right data (sightings, dashboards, reports). We do not sell your data.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Data and security</h2>
          <p>
            Your data is stored securely. Access is limited to your organisation and to Scout as needed to 
            operate the service. We may update this policy from time to time; we will post changes on this page.
          </p>
        </section>
      </div>
    </div>
  );
}
