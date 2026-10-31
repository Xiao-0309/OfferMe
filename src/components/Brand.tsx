/** Original OfferMe identity. The editable master lives in brand/mark.svg. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup${compact ? ' is-compact' : ''}`}>
    <img src="./brand/mark.svg" width="40" height="40" alt="" className="brand-mark" />
    {!compact && <span className="brand-wordmark">Offer<span>Me</span></span>}
  </div>;
}
