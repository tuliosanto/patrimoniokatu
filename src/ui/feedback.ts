/* Avisos rápidos (com "Desfazer") e diálogo de confirmação, sem dependências. */

let toastEl: HTMLDivElement | null = null;
let toastT: number | undefined;

export function toast(msg: string, opt: { erro?: boolean; desfazer?: () => void; ms?: number } = {}) {
  toastEl?.remove();
  clearTimeout(toastT);
  const el = document.createElement('div');
  el.className = 'toast' + (opt.erro ? ' err' : '');
  el.setAttribute('role', opt.erro ? 'alert' : 'status');
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  if (opt.desfazer) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Desfazer';
    b.onclick = () => { opt.desfazer!(); el.remove(); };
    el.append(b);
  }
  document.body.append(el);
  toastEl = el;
  toastT = window.setTimeout(() => el.remove(), opt.ms ?? (opt.desfazer ? 8000 : 3500));
}

/** Confirmação com <dialog> nativo (foco e Esc já resolvidos pelo navegador). */
export function confirmar(titulo: string, texto: string, ok = 'Confirmar', perigo = false): Promise<boolean> {
  return new Promise((res) => {
    const d = document.createElement('dialog');
    const h = document.createElement('h2'); h.textContent = titulo;
    const p = document.createElement('p'); p.textContent = texto;
    const acts = document.createElement('div'); acts.className = 'actions';
    const bc = document.createElement('button'); bc.type = 'button'; bc.className = 'btn ghost'; bc.textContent = 'Cancelar';
    const bo = document.createElement('button'); bo.type = 'button'; bo.className = 'btn' + (perigo ? ' danger' : ''); bo.textContent = ok;
    acts.append(bc, bo);
    d.append(h, p, acts);
    const fim = (v: boolean) => { d.close(); d.remove(); res(v); };
    bc.onclick = () => fim(false);
    bo.onclick = () => fim(true);
    d.addEventListener('cancel', (e) => { e.preventDefault(); fim(false); });
    document.body.append(d);
    d.showModal();
    bc.focus();
  });
}
