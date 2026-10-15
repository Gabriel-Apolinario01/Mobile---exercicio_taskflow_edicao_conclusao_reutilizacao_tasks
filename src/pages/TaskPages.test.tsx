import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { alterarTarefa, excluirTarefa, listarTarefas } from '../services/tarefaService';
import type { Tarefa } from '../types/Tarefa';

vi.mock('../services/tarefaService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/tarefaService')>();
  return { ...original, listarTarefas: vi.fn(), alterarTarefa: vi.fn(), criarTarefa: vi.fn(), excluirTarefa: vi.fn() };
});

const base: Tarefa = { titulo: '', descricao: '', data: '', prioridade: 'medium', projeto: '', concluida: false };
const tarefas: Tarefa[] = [
  { ...base, _id: 'hoje', titulo: 'Prazo hoje', data: '2026-10-08' },
  { ...base, _id: 'futura', titulo: 'Prazo futuro', data: '2026-10-09' },
  { ...base, _id: 'atrasada', titulo: 'Prazo atrasado', data: '2026-10-07' },
  { ...base, _id: 'sem-prazo', titulo: 'Sem data definida' },
  { ...base, _id: 'concluida-hoje', titulo: 'Finalizada hoje', data: '2026-10-08', concluida: true },
  { ...base, _id: 'concluida-futura', titulo: 'Finalizada adiantada', data: '2026-10-09', concluida: true },
];

beforeEach(() => {
  // Em America/Sao_Paulo, este horário já corresponde ao dia seguinte em UTC.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 23, 30));
  vi.mocked(listarTarefas).mockReset().mockResolvedValue(tarefas);
  vi.mocked(alterarTarefa).mockReset().mockImplementation(async (id, tarefa) => ({ ...tarefa, _id: id }));
  vi.mocked(excluirTarefa).mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

function renderizar(caminho = '/tarefas') {
  window.history.replaceState(null, '', caminho);
  return render(<App />);
}

describe('Páginas de tarefas', () => {
  it.each([
    ['/', ['Prazo hoje']],
    ['/proximas', ['Prazo futuro']],
    ['/concluidas', ['Finalizada hoje', 'Finalizada adiantada']],
    ['/tarefas', tarefas.filter((tarefa) => !tarefa.concluida).map((tarefa) => tarefa.titulo)],
  ])('filtra corretamente a coleção em %s pela data local e conclusão', async (caminho, titulos) => {
    renderizar(caminho);
    const lista = await screen.findByRole('list', { name: 'Lista de tarefas' });
    expect(within(lista).getAllByRole('heading').map((titulo) => titulo.textContent)).toEqual(titulos);
  });

  it.each(['/', '/proximas', '/concluidas', '/tarefas'])('mostra carregamento e coleção vazia em %s', async (caminho) => {
    let concluir!: (valor: Tarefa[]) => void;
    vi.mocked(listarTarefas).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    renderizar(caminho);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando tarefas...');
    expect(screen.queryByText('Nada por aqui')).not.toBeInTheDocument();
    await act(async () => { concluir([]); });
    expect(screen.getByRole('status')).toHaveTextContent('Nada por aqui');
  });

  it('mostra falha de carregamento sem afirmar que a coleção está vazia', async () => {
    vi.mocked(listarTarefas).mockRejectedValue(new Error('Sem rede'));
    renderizar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as tarefas');
    expect(screen.queryByText('Nada por aqui')).not.toBeInTheDocument();
    expect(screen.queryByText('Carregando tarefas...')).not.toBeInTheDocument();
  });

  it('preserva todos os registros após falha na exclusão e permite tentar novamente', async () => {
    vi.mocked(excluirTarefa).mockRejectedValueOnce(new Error('Sem rede'));
    renderizar();
    const excluir = await screen.findByRole('button', { name: 'Excluir tarefa: Prazo hoje' });
    fireEvent.click(excluir);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível confirmar a exclusão.');
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(excluir).toBeEnabled();
    fireEvent.click(excluir);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prazo hoje' })).not.toBeInTheDocument());
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('só retira o card depois de a exclusão terminar com sucesso', async () => {
    let concluir!: () => void;
    vi.mocked(excluirTarefa).mockReturnValue(new Promise<void>((resolve) => { concluir = resolve; }));
    vi.mocked(listarTarefas).mockResolvedValue([tarefas[0]]);
    renderizar();
    const botao = await screen.findByRole('button', { name: 'Excluir tarefa: Prazo hoje' });
    fireEvent.click(botao);
    expect(botao).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Prazo hoje' })).toBeInTheDocument();
    await act(async () => { concluir(); });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nada por aqui');
  });
});

describe('Conclusão compartilhada entre as páginas', () => {
  it('conclui e reabre mantendo o identificador sem recarregar a coleção', async () => {
    renderizar('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir tarefa: Prazo hoje' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prazo hoje' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: 'Concluídas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir tarefa: Prazo hoje' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Prazo hoje' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: 'Hoje' }));
    expect(await screen.findByRole('heading', { name: 'Prazo hoje' })).toBeInTheDocument();
    const { _id, ...dados } = tarefas[0];
    expect(alterarTarefa).toHaveBeenNthCalledWith(1, _id, { ...dados, concluida: true });
    expect(alterarTarefa).toHaveBeenNthCalledWith(2, _id, dados);
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('preserva o card e o estado após rejeição da atualização', async () => {
    vi.mocked(alterarTarefa).mockRejectedValueOnce(new Error('Sem rede'));
    renderizar('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir tarefa: Prazo hoje' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Concluir tarefa: Prazo hoje' })).toBeEnabled());
    expect(screen.getByRole('heading', { name: 'Prazo hoje' })).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('bloqueia ações concorrentes até a persistência terminar', async () => {
    let concluir!: (tarefa: Tarefa) => void;
    vi.mocked(alterarTarefa).mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    renderizar('/');
    const botao = await screen.findByRole('button', { name: 'Concluir tarefa: Prazo hoje' });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(botao).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir tarefa: Prazo hoje' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Editar tarefa: Prazo hoje' })).toBeDisabled();
    expect(alterarTarefa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Prazo hoje' })).toBeInTheDocument();
    await act(async () => { concluir({ ...tarefas[0], concluida: true }); });
    expect(screen.queryByRole('heading', { name: 'Prazo hoje' })).not.toBeInTheDocument();
  });
});
