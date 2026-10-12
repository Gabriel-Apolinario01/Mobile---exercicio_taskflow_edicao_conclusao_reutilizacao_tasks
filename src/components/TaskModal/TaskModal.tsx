import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTarefas } from '../../contexts/TarefasContext';
import type { NovaTarefa, Tarefa } from '../../types/Tarefa';
import { TaskForm } from '../TaskForm/TaskForm';
import './TaskModal.css';

type TaskModalProps = { aberto: boolean; tarefa?: Tarefa | null; aoFechar: () => void };

function elementosFocaveis(painel: HTMLElement): HTMLElement[] {
  return Array.from(painel.querySelectorAll<HTMLElement>(
    'button, input, textarea, select, a[href], [tabindex]',
  )).filter((elemento) => elemento.tabIndex >= 0 && !elemento.matches(':disabled, [hidden], [inert]'));
}

export function TaskModal({ aberto, tarefa = null, aoFechar }: Readonly<TaskModalProps>) {
  const { adicionarTarefa, editarTarefa } = useTarefas();
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const envioEmAndamento = useRef(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !painelRef.current || !overlayRef.current) return;

    const painel = painelRef.current;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowBody = document.body.style.overflow;
    const overflowHtml = document.documentElement.style.overflow;
    // O portal fica fora do root, permitindo bloquear o restante da aplicação.
    const elementosAoFundo = Array.from(document.body.children)
      .filter((elemento) => elemento !== overlayRef.current)
      .map((elemento) => ({ elemento, inertAnterior: elemento.getAttribute('inert') }));

    elementosAoFundo.forEach(({ elemento }) => elemento.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    painel.querySelector<HTMLInputElement>('input[name="titulo"]')?.focus();

    function manterFoco(evento: FocusEvent) {
      if (evento.target instanceof Node && !painel.contains(evento.target)) {
        (elementosFocaveis(painel)[0] ?? painel).focus();
      }
    }
    document.addEventListener('focusin', manterFoco);

    return () => {
      document.removeEventListener('focusin', manterFoco);
      elementosAoFundo.forEach(({ elemento, inertAnterior }) => {
        if (inertAnterior === null) elemento.removeAttribute('inert');
        else elemento.setAttribute('inert', inertAnterior);
      });
      document.body.style.overflow = overflowBody;
      document.documentElement.style.overflow = overflowHtml;
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
  }, [aberto]);

  useEffect(() => {
    // Desabilitar o botão de envio pode mover o foco para o body no navegador.
    if (aberto && salvando) painelRef.current?.focus();
  }, [aberto, salvando]);

  function solicitarFechamento() {
    if (!envioEmAndamento.current) aoFechar();
  }

  async function salvarTarefa(novaTarefa: NovaTarefa) {
    envioEmAndamento.current = true;
    setSalvando(true);
    try {
      if (tarefa) await editarTarefa({ ...novaTarefa, _id: tarefa._id });
      else await adicionarTarefa(novaTarefa);
      aoFechar();
    } finally {
      envioEmAndamento.current = false;
      setSalvando(false);
    }
  }

  function controlarTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      evento.stopPropagation();
      solicitarFechamento();
    }
    if (evento.key !== 'Tab' || !painelRef.current) return;

    const focaveis = elementosFocaveis(painelRef.current);
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro) {
      evento.preventDefault();
      painelRef.current.focus();
    } else if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === painelRef.current)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (document.activeElement === ultimo || document.activeElement === painelRef.current)) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  if (!aberto) return null;

  return createPortal(
    <div className="task-modal" ref={overlayRef}>
      <div
        className="task-modal__content" ref={painelRef} role="dialog"
        aria-modal="true" aria-label={tarefa ? `Editar tarefa: ${tarefa.titulo}` : 'Nova tarefa'} tabIndex={-1}
        onKeyDown={controlarTeclado}
      >
        <button
          className="task-modal__close" type="button" aria-label="Fechar"
          onClick={solicitarFechamento} disabled={salvando}
        ><X size={20} aria-hidden="true" /></button>
        <TaskForm tarefaInicial={tarefa} aoSalvar={salvarTarefa} aoCancelar={solicitarFechamento} />
      </div>
    </div>,
    document.body,
  );
}
