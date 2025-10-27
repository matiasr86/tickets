const form = document.getElementById('f');
const nameEl = document.getElementById('name');
const keyEl  = document.getElementById('adminKey');
const btn    = document.getElementById('btn');
const msg    = document.getElementById('msg');
const out    = document.getElementById('out');

function setMsg(text, ok=false) {
  msg.innerHTML = `<span class="msg ${ok ? 'ok' : 'err'}">${text}</span>`;
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameEl.value.trim();
  const adminKey = keyEl.value.trim();

  if (!name) { setMsg('Ingresá un nombre.'); nameEl.focus(); return; }
  if (!adminKey) { setMsg('Ingresá la Admin Key.'); keyEl.focus(); return; }

  setMsg('Creando vendedor…');
  btn.disabled = true;

  try {
    const res = await fetch('/api/admin/vendors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({ name })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      setMsg(`Error ${res.status}: ${data?.error || text}`, false);
      out.textContent = text;
    } else {
      setMsg('Vendedor creado ✅', true);
      out.textContent = JSON.stringify(data, null, 2);
      // Opcional: limpiar nombre
      nameEl.value = '';
      nameEl.focus();
    }
  } catch (err) {
    console.error(err);
    setMsg('No se pudo contactar el servidor.', false);
  } finally {
    btn.disabled = false;
  }
});
