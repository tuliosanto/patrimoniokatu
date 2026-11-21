import { Toaster as Sonner, type ToasterProps } from 'sonner';

/* Avisos curtos, sem ícones; fonte e cores da direção H. */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    icons={{ success: null, info: null, warning: null, error: null, loading: null }}
    toastOptions={{
      unstyled: false,
      style: { background: 'var(--dado)', color: 'var(--fundo)', border: 0, borderRadius: 0, fontFamily: 'var(--h-fonte-leitura)', fontSize: 15 },
    }}
    {...props}
  />
);

export { Toaster };
