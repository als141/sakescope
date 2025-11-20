import React from 'react';

const WatercolorBackground = () => {
  return (
    <div className="watercolor-bg" aria-hidden="true">
      <div className="watercolor-backdrop" />
      <span
        className="watercolor-ring"
        style={
          {
            '--ring-color': 'oklch(0.72 0.14 75)',
            '--ring-size': 'min(70vw, 900px)',
            '--ring-top': '-12%',
            '--ring-left': '-8%',
            '--ring-speed': '28s',
            '--ring-rotate': '38s',
            '--ring-delay': '-4s',
            '--ring-opacity': '0.18',
          } as React.CSSProperties
        }
      />
      <span
        className="watercolor-ring"
        style={
          {
            '--ring-color': 'oklch(0.78 0.10 220)',
            '--ring-size': 'min(52vw, 720px)',
            '--ring-bottom': '-10%',
            '--ring-right': '-4%',
            '--ring-speed': '24s',
            '--ring-rotate': '30s',
            '--ring-delay': '-7s',
            '--ring-opacity': '0.16',
          } as React.CSSProperties
        }
      />
      <span
        className="watercolor-ring"
        style={
          {
            '--ring-color': 'oklch(0.82 0.12 140)',
            '--ring-size': 'min(44vw, 640px)',
            '--ring-top': '18%',
            '--ring-right': '12%',
            '--ring-speed': '21s',
            '--ring-rotate': '26s',
            '--ring-delay': '-2s',
            '--ring-opacity': '0.16',
          } as React.CSSProperties
        }
      />
      <span
        className="watercolor-ring"
        style={
          {
            '--ring-color': 'oklch(0.80 0.16 40)',
            '--ring-size': 'min(38vw, 520px)',
            '--ring-bottom': '6%',
            '--ring-left': '8%',
            '--ring-speed': '25s',
            '--ring-rotate': '32s',
            '--ring-delay': '-10s',
            '--ring-opacity': '0.15',
          } as React.CSSProperties
        }
      />
      <span
        className="watercolor-ring"
        style={
          {
            '--ring-color': 'oklch(0.86 0.08 310)',
            '--ring-size': 'min(32vw, 460px)',
            '--ring-top': '48%',
            '--ring-left': '48%',
            '--ring-speed': '18s',
            '--ring-rotate': '24s',
            '--ring-delay': '-6s',
            '--ring-opacity': '0.16',
          } as React.CSSProperties
        }
      />
      <div className="watercolor-noise" />
    </div>
  );
};

export default WatercolorBackground;
