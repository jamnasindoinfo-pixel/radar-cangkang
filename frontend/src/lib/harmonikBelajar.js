// Ukuran posisi (lot) untuk rencana Long/Short di tab Saham halaman Harmonic Pattern.

// Ukuran posisi saham BEI (1 lot = 100 lembar): risiko rupiah = modal x risiko%; lot = risiko / (selisih entry-stop x 100).
export function ukuranPosisi({ modal, risikoPct, entry, stop, target } = {}) {
  modal = Number(modal); risikoPct = Number(risikoPct); entry = Number(entry); stop = Number(stop); target = Number(target)
  if (!(modal > 0 && risikoPct > 0 && entry > 0 && stop > 0) || entry === stop) return null
  const risikoRp = modal * risikoPct / 100, perLot = Math.abs(entry - stop) * 100
  const lot = Math.max(0, Math.floor(risikoRp / perLot)), nilai = lot * entry * 100
  return { risikoRp, lot, nilai, pctModal: Math.round(nilai / modal * 1000) / 10, rugiMaks: lot * perLot,
    rr: target > 0 ? Math.round(Math.abs(target - entry) / Math.abs(entry - stop) * 10) / 10 : null, cukup: nilai <= modal }
}

