import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { alterarTarefa, criarTarefa, excluirTarefa, listarTarefas } from '../../services/tarefaService';

vi.mock('../../services/tarefaService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/tarefaService')>();
  return { ...original, listarTarefas: vi.fn(), criarTarefa: vi.fn(), alterarTarefa: vi.fn(), excluirTarefa: vi.fn() };
});

beforeEach(() => {
  window.history.replaceState(null, '', '/tarefas');
  vi.mocked(listarTarefas).mockReset().mockResolvedValue([]);
  vi.mocked(criarTarefa).mockReset().mockImplementation(async (tarefa) => ({ ...tarefa, _id: 'nova' }));
  vi.mocked(alterarTarefa).mockReset().mockImplementation(async (id, tarefa) => ({ ...tarefa, _id: id }));
  vi.mocked(excluirTarefa).mockReset().mockResolvedValue(undefined);
});

describe('Layout integrado', () => {
  it('busca por título, descrição e projeto sem acentos e restaura a coleção ao limpar', async () => {
    const base = { descricao: '', data: '', prioridade: 'medium' as const, projeto: '', concluida: false };
    vi.mocked(listarTarefas).mockResolvedValue([
      { ...base, _id: '1', titulo: 'Revisão comercial', descricao: 'Conferir orçamento', projeto: 'Atlas' },
      { ...base, _id: '2', titulo: 'Estudar React' },
    ]);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Revisão comercial' });
    const busca = screen.getByRole('searchbox', { name: 'Buscar tarefas' });
    for (const termo of ['REVISAO', 'orcamento', 'atlas']) {
      await user.clear(busca);
      await user.type(busca, termo);
      expect(screen.getByRole('heading', { name: 'Revisão comercial' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Estudar React' })).not.toBeInTheDocument();
    }
    await user.clear(busca);
    await user.type(busca, 'inexistente');
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma tarefa encontrada');
    await user.clear(busca);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('combina a busca da URL com o filtro da página sem alterar os dados compartilhados', async () => {
    const base = { descricao: '', data: '', prioridade: 'medium' as const, projeto: '' };
    vi.mocked(listarTarefas).mockResolvedValue([
      { ...base, _id: '1', titulo: 'React concluído', concluida: true },
      { ...base, _id: '2', titulo: 'React pendente', concluida: false },
      { ...base, _id: '3', titulo: 'CSS concluído', concluida: true },
    ]);
    window.history.replaceState(null, '', '/concluidas?q=react');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'React concluído' });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('searchbox')).toHaveValue('react');
    await user.clear(screen.getByRole('searchbox'));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.click(screen.getByRole('link', { name: 'Todas as tarefas' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('abre um único modal por cada um dos três botões e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText('Nada por aqui');
    const botoes = screen.getAllByRole('button', { name: 'Nova tarefa' });
    expect(botoes).toHaveLength(3);
    for (const botao of botoes) {
      await user.click(botao);
      expect(screen.getAllByRole('dialog', { name: 'Nova tarefa' })).toHaveLength(1);
      expect(container).toHaveAttribute('inert');
      expect(screen.getByLabelText(/Título/)).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(container).not.toHaveAttribute('inert');
      expect(botao).toHaveFocus();
    }
  });

  it('cria pelo modal compartilhado e atualiza o card sem recarregar a página', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Nada por aqui');
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Nova tarefa' }));
    await user.type(screen.getByLabelText(/Título/), 'Entregar interface');
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByRole('heading', { name: 'Entregar interface' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledExactlyOnceWith({ titulo: 'Entregar interface', descricao: '', data: '', prioridade: 'medium', projeto: '', concluida: false });
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('edita uma tarefa no mesmo modal, preserva o identificador e atualiza o card', async () => {
    const tarefa = {
      _id: 'existente', titulo: 'Estudar React', descricao: 'Revisar hooks', data: '2026-10-13',
      prioridade: 'high' as const, projeto: 'TaskFlow', concluida: false,
    };
    vi.mocked(listarTarefas).mockResolvedValue([tarefa]);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Estudar React' });
    await user.click(screen.getByRole('button', { name: 'Editar tarefa: Estudar React' }));

    const dialogo = screen.getByRole('dialog', { name: 'Editar tarefa: Estudar React' });
    expect(within(dialogo).getByLabelText(/Título/)).toHaveValue('Estudar React');
    expect(within(dialogo).getByLabelText(/Descrição/)).toHaveValue('Revisar hooks');
    expect(within(dialogo).getByLabelText('Prazo Opcional')).toHaveValue('2026-10-13');
    await user.clear(within(dialogo).getByLabelText(/Título/));
    await user.type(within(dialogo).getByLabelText(/Título/), 'Estudar React e TypeScript');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('heading', { name: 'Estudar React e TypeScript' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(alterarTarefa).toHaveBeenCalledExactlyOnceWith('existente', {
      titulo: 'Estudar React e TypeScript', descricao: 'Revisar hooks', data: '2026-10-13',
      prioridade: 'high', projeto: 'TaskFlow', concluida: false,
    });
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('mantém o modal e os campos quando o cadastro falha, orienta sobre o endpoint e permite tentar novamente', async () => {
    vi.mocked(criarTarefa).mockRejectedValueOnce(new Error('Network Error'));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Nada por aqui');
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Nova tarefa' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Nova tarefa' }));
    await user.type(dialogo.getByLabelText(/Título/), 'Preservar meu cadastro');
    await user.click(dialogo.getByRole('button', { name: 'Criar tarefa' }));
    expect(await dialogo.findByRole('alert')).toHaveTextContent('Abra Todas as tarefas e recarregue a página');
    expect(dialogo.getByRole('alert')).toHaveTextContent('a tarefa pode ter sido salva');
    expect(criarTarefa).toHaveBeenCalledTimes(1);
    expect(dialogo.getByLabelText(/Título/)).toHaveValue('Preservar meu cadastro');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    await user.click(dialogo.getByRole('button', { name: 'Criar tarefa' }));
    expect(await screen.findByRole('heading', { name: 'Preservar meu cadastro' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(criarTarefa).toHaveBeenCalledTimes(2);
  });

  it('preserva Header e Sidebar nas quatro rotas e destaca apenas o link ativo', async () => {
    const user = userEvent.setup();
    render(<App />);
    const header = screen.getByRole('banner');
    const sidebar = screen.getByRole('complementary');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    for (const nome of ['Hoje', 'Próximas', 'Concluídas', 'Todas as tarefas']) {
      const link = within(nav).getByRole('link', { name: nome });
      await user.click(link);
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(nome));
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getAllByRole('link').filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);
      expect(screen.getByRole('banner')).toBe(header);
      expect(screen.getByRole('complementary')).toBe(sidebar);
    }
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });
});
