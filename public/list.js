const tbody = document.querySelector('#tbl tbody');
const filterForm = document.getElementById('filter');
const tokenInput = document.getElementById('token');
const counterEl = document.getElementById('counter');

function fmtMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n || 0);
}

async function fetchTickets(token) {
  const url = token ? `/api/tickets?token=${encodeURIComponent(token)}` : '/api/tickets';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} – ${t.slice(0,180)}`);
  }
  return res.json();
}

async function deleteTicket(id, token) {
  const res = await fetch(`/api/tickets/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-vendor-token': token }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || text || 'No se pudo borrar');
  }
}

function renderRows(items) {
  tbody.innerHTML = '';
  let total = 0;
  items.forEach(t => {
    total += Number(t.amount) || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.ticketNo}</td>
      <td>${t.vendorName}</td>
      <td>${t.buyer}</td>
      <td>${fmtMoney(t.amount)}</td>
      <td>${t.status === 'unused' ? 'Sin usar' : 'Usada'}</td>
      <td><button data-id="${t._id}">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
  });
  if (counterEl) counterEl.textContent = `${items.length} entradas · Total ${fmtMoney(total)}`;
}

export async function loadList() {
  try {
    const token = (tokenInput?.value || '').trim();
    const items = await fetchTickets(token);
    renderRows(items);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="color:#b00020">Error al cargar listado: ${err.message}</td></tr>`;
  }
}

tbody?.addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON') {
    const id = e.target.getAttribute('data-id');
    const token = prompt('Ingresá el token del vendedor para borrar:');
    if (!token) return;
    try {
      await deleteTicket(id, token.trim());
      await loadList();
    } catch (err) {
      alert('No se pudo borrar: ' + err.message);
    }
  }
});

filterForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  loadList();
});

// Carga inicial
loadList();
