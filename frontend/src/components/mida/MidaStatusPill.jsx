export default function MidaStatusPill({ variant, icon: Icon, label, value }) {
  const title = `${label}: ${value}`;

  return (
    <div className={`mida-status-pill mida-status-pill--${variant}`} title={title} aria-label={title}>
      <div className="mida-status-pill__icon-wrap" aria-hidden="true">
        <Icon className="mida-status-pill__icon" size={18} strokeWidth={2.25} />
      </div>
      <div className="mida-status-pill__body">
        <span className="mida-status-pill__label">{label}</span>
        <span className="mida-status-pill__value">{value}</span>
      </div>
    </div>
  );
}
