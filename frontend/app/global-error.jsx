'use client';

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <h1>Something went wrong</h1>
          <p>Please reload the page. Your data is safe.</p>
          <button type="button" onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
