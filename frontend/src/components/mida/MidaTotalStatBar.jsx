export default function MidaTotalStatBar({ icon: Icon, label, value }) {
  const title = `${label}: ${value}`;

  return (
    <div className="mida-total-stat" aria-label={title} title={title}>
      <div className="mida-total-stat__icon-box" aria-hidden="true">
        <Icon className="mida-total-stat__icon" size={22} strokeWidth={2} />
      </div>
      <div className="mida-total-stat__bar">
        <span className="mida-total-stat__label">{label}</span>
        <span className="mida-total-stat__value">{value}</span>
      </div>
    </div>
  );
}
