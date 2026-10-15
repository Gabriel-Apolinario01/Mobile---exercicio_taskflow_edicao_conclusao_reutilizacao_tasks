import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskModal } from './TaskModal';
import { TarefasProvider, useTarefas } from '../../contexts/TarefasContext';
import { alterarTarefa, criarTarefa, listarTarefas } from '../../services/tarefaService';
import type { Tarefa } from '../../types/Tarefa';

vi.mock('../../services/tarefaService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/tarefaService')>();
  return { ...original, listarTarefas: vi.fn(), criarTarefa: vi.fn(), alterarTarefa: vi.fn() };
});

const tarefaCriada: Tarefa = {
  _id: 'gerado-pela-api', titulo: 'Estudar React', descricao: '', data: '',
  prioridade: 'medium', projeto: '', concluida: false,
};

const tarefaExistente: Tarefa = {
  _id: 'abc123', titulo: 'Estudar React', descricao: 'Revisar hooks', data: '2026-10-13',
  prioridade: 'high', projeto: 'TaskFlow', concluida: false,
};

function TelaDeTeste({ tarefa = null }: { tarefa?: Tarefa | null } = {}) {
  const [aberto, setAberto] = useState(false);
  const { tarefas } = useTarefas();
  return <>
    <button type="button" onClick={() => setAberto(true)}>Abrir cadastro</button>
    <a href="#outro">Link ao fundo</a>
    <output aria-label="Tarefas cadastradas">{tarefas.map((t) => t._id).join(',')}</output>
    <TaskModal aberto={aberto} tarefa={tarefa} aoFechar={() => setAberto(false)} />
  </>;
}

function renderizar(tarefa: Tarefa | null = null) {
  return render(
    <TarefasProvider>
      <TelaDeTeste tarefa={tarefa} />
    </TarefasProvider>
  );
}

beforeEach(() => {
  vi.mocked(listarTarefas).mockReset().mockResolvedValue([]);
  vi.mocked(criarTarefa).mockReset().mockResolvedValue(tarefaCriada);
  vi.mocked(alterarTarefa).mockReset().mockImplementation(async (id, tarefa) => ({ ...tarefa, _id: id }));
});

describe('TaskModal', () => {
  // ---------- Criação (testes originais) ----------

  it('fechado não produz janela nem overlay', () => {
    renderizar();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.task-modal')).toBeNull();
  });

  it('abre uma janela acessível, bloqueia o fundo e foca o título', async () => {
    const user = userEvent.setup();
    const { container } = renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova tarefa' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByLabelText(/Título/)).toHaveFocus();
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it.each(['Fechar', 'Cancelar'])('%s remove o overlay e devolve o foco ao botão de origem', async (nome) => {
    const user = userEvent.setup();
    const { container } = renderizar();
    const gatilho = screen.getByRole('button', { name: 'Abrir cadastro' });
    await user.click(gatilho);
    await user.click(screen.getByRole('button', { name: nome }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.task-modal')).toBeNull();
    expect(container).not.toHaveAttribute('inert');
    expect(gatilho).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape fecha a janela quando não existe envio em andamento', async () => {
    const user = userEvent.setup();
    renderizar();
    const gatilho = screen.getByRole('button', { name: 'Abrir cadastro' });
    await user.click(gatilho);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('mantém Tab e Shift+Tab dentro do painel', async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    const ultimo = screen.getByRole('button', { name: 'Criar tarefa' });
    const primeiro = screen.getByRole('button', { name: 'Fechar' });
    ultimo.focus();
    await user.tab();
    expect(primeiro).toHaveFocus();
    await user.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it('recupera foco que for movido programaticamente para fora da janela', async () => {
    const user = userEvent.setup();
    renderizar();
    const linkAoFundo = screen.getByRole('link', { name: 'Link ao fundo' });
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    linkAoFundo.focus();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('preserva a janela durante o envio e fecha só após atualizar o contexto', async () => {
    let concluir!: (tarefa: Tarefa) => void;
    vi.mocked(criarTarefa).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    await user.type(screen.getByLabelText(/Título/), 'Estudar React');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => { concluir(tarefaCriada); });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tarefas cadastradas')).toHaveTextContent('gerado-pela-api');
    expect(criarTarefa).toHaveBeenCalledTimes(1);
  });

  it('falha na API não fecha nem limpa os campos; nova tentativa conclui o cadastro', async () => {
    vi.mocked(criarTarefa).mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValueOnce(tarefaCriada);
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    await user.type(screen.getByLabelText(/Título/), 'Estudar React');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar o cadastro.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('Estudar React');
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tarefas cadastradas')).toHaveTextContent('gerado-pela-api');
  });

  it('reabre com campos limpos depois de cancelar', async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    await user.type(screen.getByLabelText(/Título/), 'Rascunho cancelado');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
  });

  it('clicar no overlay não descarta o formulário', async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
    fireEvent.click(document.querySelector('.task-modal')!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('restaura inert e overflow preexistentes ao desmontar no StrictMode', async () => {
    const user = userEvent.setup();
    const previamenteInerte = document.createElement('aside');
    previamenteInerte.setAttribute('inert', '');
    document.body.append(previamenteInerte);
    document.body.style.overflow = 'scroll';
    document.documentElement.style.overflow = 'auto';
    try {
      const { container, unmount } = render(<TarefasProvider><TelaDeTeste /></TarefasProvider>, { reactStrictMode: true });
      await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));
      expect(container).toHaveAttribute('inert');
      unmount();
      expect(previamenteInerte).toHaveAttribute('inert');
      expect(container).not.toHaveAttribute('inert');
      expect(document.body.style.overflow).toBe('scroll');
      expect(document.documentElement.style.overflow).toBe('auto');
    } finally {
      previamenteInerte.remove();
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  });

  // ---------- Evolução: modo edição (TaskModal com `tarefa`) ----------

  it('no modo edição usa nome acessível próprio e preenche o formulário com os dados existentes', async () => {
    const user = userEvent.setup();
    renderizar(tarefaExistente);
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));

    const dialog = screen.getByRole('dialog', { name: 'Editar tarefa: Estudar React' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'Editar tarefa' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Título/)).toHaveValue('Estudar React');
    expect(within(dialog).getByLabelText(/Descrição/)).toHaveValue('Revisar hooks');
    expect(within(dialog).getByLabelText('Prazo Opcional')).toHaveValue('2026-10-13');
    expect(within(dialog).getByLabelText('Prioridade')).toHaveValue('high');
    expect(within(dialog).getByLabelText(/Projeto/)).toHaveValue('TaskFlow');
    expect(within(dialog).getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    // Nada de "Criar tarefa" no modo edição
    expect(within(dialog).queryByRole('button', { name: 'Criar tarefa' })).not.toBeInTheDocument();
  });

  it('no modo edição envia pelo contexto com o mesmo _id e fecha só após o sucesso', async () => {
    let concluir!: (t: Tarefa) => void;
    vi.mocked(alterarTarefa).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    const user = userEvent.setup();
    renderizar(tarefaExistente);
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));

    await user.clear(screen.getByLabelText(/Título/));
    await user.type(screen.getByLabelText(/Título/), 'Estudar React e TypeScript');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    // Modal continua aberto até a resposta
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(alterarTarefa).toHaveBeenCalledExactlyOnceWith('abc123', {
      titulo: 'Estudar React e TypeScript',
      descricao: 'Revisar hooks',
      data: '2026-10-13',
      prioridade: 'high',
      projeto: 'TaskFlow',
      concluida: false,
    });

    await act(async () => {
      concluir({
        _id: 'abc123',
        titulo: 'Estudar React e TypeScript',
        descricao: 'Revisar hooks',
        data: '2026-10-13',
        prioridade: 'high',
        projeto: 'TaskFlow',
        concluida: false,
      });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('no modo edição, falha mantém a janela aberta, exibe o alerta e preserva os valores digitados', async () => {
    vi.mocked(alterarTarefa).mockRejectedValueOnce(new Error('Sem conexão'));
    const user = userEvent.setup();
    renderizar(tarefaExistente);
    await user.click(screen.getByRole('button', { name: 'Abrir cadastro' }));

    await user.clear(screen.getByLabelText(/Título/));
    await user.type(screen.getByLabelText(/Título/), 'Título que não deve ser perdido');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a edição.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('Título que não deve ser perdido');
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeEnabled();
    expect(alterarTarefa).toHaveBeenCalledTimes(1);
  });

  it.each(['Fechar', 'Cancelar'])('no modo edição, %s fecha a janela sem persistir', async (nome) => {
    const user = userEvent.setup();
    const { container } = renderizar(tarefaExistente);
    const gatilho = screen.getByRole('button', { name: 'Abrir cadastro' });
    await user.click(gatilho);
    await user.click(screen.getByRole('button', { name: nome }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(alterarTarefa).not.toHaveBeenCalled();
    expect(container).not.toHaveAttribute('inert');
    expect(gatilho).toHaveFocus();
  });

  it('no modo edição, Escape fecha quando não há envio em andamento', async () => {
    const user = userEvent.setup();
    renderizar(tarefaExistente);
    const gatilho = screen.getByRole('button', { name: 'Abrir cadastro' });
    await user.click(gatilho);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(alterarTarefa).not.toHaveBeenCalled();
    expect(gatilho).toHaveFocus();
  });

  it('reabrir em modo criação depois de editar mostra formulário vazio (sem herdar a tarefa anterior)', async () => {
    const user = userEvent.setup();

    function TelaAlternada() {
      const [tarefa, setTarefa] = useState<Tarefa | null>(tarefaExistente);
      const [aberto, setAberto] = useState(false);
      return <>
        <button type="button" onClick={() => { setTarefa(null); setAberto(true); }}>
          Nova tarefa
        </button>
        <button type="button" onClick={() => { setTarefa(tarefaExistente); setAberto(true); }}>
          Editar
        </button>
        <TaskModal aberto={aberto} tarefa={tarefa} aoFechar={() => setAberto(false)} />
      </>;
    }
    render(<TarefasProvider><TelaAlternada /></TarefasProvider>);

    // Abre em edição, vê os valores preenchidos
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText(/Título/)).toHaveValue('Estudar React');
    await user.keyboard('{Escape}');

    // Reabre como criação: campos vazios
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    expect(screen.getByRole('dialog', { name: 'Nova tarefa' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toHaveValue('');
    expect(screen.getByLabelText(/Projeto/)).toHaveValue('');
  });
});