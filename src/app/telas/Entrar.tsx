import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { entrar, mensagemLogin } from '@/data/firebase';

export function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try { await entrar(email.trim(), senha); }
    catch (x) { setErro(mensagemLogin((x as { code?: string }).code ?? '')); }
    finally { setEnviando(false); }
  }

  return (
    <main className="min-h-dvh px-[5vw] pt-[8vh]">
      <h1 className="marco text-2xl italic">Nosso Patrimônio</h1>
      <form onSubmit={enviar} className="degrau-2 pausa grid max-w-sm gap-6" noValidate>
        <div className="grid gap-1">
          <Label htmlFor="email" className="rotulo">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="senha" className="rotulo">Senha</Label>
          <Input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p role="alert" className="text-erro">{erro}</p>}
        <Button type="submit" variant="agora" disabled={enviando || !email || !senha} className="justify-self-start">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </main>
  );
}
