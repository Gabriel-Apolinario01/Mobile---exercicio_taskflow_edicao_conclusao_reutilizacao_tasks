import type { ReactNode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TarefasProvider, useTarefas } from './TarefasContext';
import { alterarTarefa, ConfiguracaoApiError, criarTarefa, excluirTarefa, listarTarefas } from '../services/tarefaService';
import type { NovaTarefa, Tarefa } from '../types/Tarefa';

vi.mock('../services/tarefaService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/tarefaService')>();
  return { ...original, listarTarefas: vi.fn(), criarTarefa: vi.fn(), alterarTarefa: vi.fn(), excluirTarefa: vi.fn() };
});

const nova: NovaTarefa = {
  titulo: 'Testar o contexto', descricao: '', data: '2026-11-09',
  prioridade: 'medium', projeto: 'TaskFlow', concluida: false,
};
const antiga: Tarefa = { ...nova, _id: 'antiga', titulo: 'Tarefa anterior' };
const criada: Tarefa = { ...nova, _id: 'nova' };
const wrapper = ({ children }: { children: ReactNode }) => <TarefasProvider>{children}</TarefasProvider>;

function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>((resolve) => { resolver = resolve; });
  return { promise, resolver };
}

beforeEach(() => {
  vi.mocked(listarTarefas).mockReset().mockResolvedValue([antiga]);
  vi.mocked(criarTarefa).mockReset().mockResolvedValue(criada);
  vi.mocked(alterarTarefa).mockReset().mockImplementation(async (id, tarefa) => ({ ...tarefa, _id: id }));
  vi.mocked(excluirTarefa).mockReset().mockResolvedValue(undefined);
});

describe('TarefasProvider', () => {
  it('carrega a coleção e encerra o estado de carregamento', async () => {
    const { result } = renderHook(useTarefas, { wrapper });
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.tarefas).toEqual([antiga]));
    expect(result.current.carregando).toBe(false);
    expect(result.current.erro).toBe('');
  });

  it('expõe falha de carregamento sem ficar preso no carregando', async () => {
    vi.mocked(listarTarefas).mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.erro).toContain('Não foi possível carregar');
  });

  it('explica como configurar um endpoint ausente', async () => {
    vi.mocked(listarTarefas).mockRejectedValue(new ConfiguracaoApiError());
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.erro).toContain('VITE_API_URL'));
  });

  it('só adiciona a tarefa depois do POST e mantém o _id do servidor', async () => {
    const envio = pendente<Tarefa>();
    vi.mocked(criarTarefa).mockReturnValue(envio.promise);
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    let operacao!: Promise<void>;
    act(() => { operacao = result.current.adicionarTarefa(nova); });
    expect(result.current.tarefas).toEqual([antiga]);
    await act(async () => { envio.resolver(criada); await operacao; });
    expect(result.current.tarefas).toEqual([criada, antiga]);
    expect(criarTarefa).toHaveBeenCalledWith(nova);
  });

  it('rejeita criação com falha, mantém a lista e permite nova tentativa', async () => {
    vi.mocked(criarTarefa).mockRejectedValueOnce(new Error('Sem rede'));
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => {
      await expect(result.current.adicionarTarefa(nova)).rejects.toThrow('Não foi possível confirmar o cadastro');
    });
    expect(result.current.tarefas).toEqual([antiga]);
    expect(result.current.erro).toContain('Não foi possível confirmar o cadastro.');
    expect(result.current.erro).toContain('endpoint do CrudCrud');
    await act(async () => { await result.current.adicionarTarefa(nova); });
    expect(result.current.erro).toBe('');
    expect(result.current.tarefas).toEqual([criada, antiga]);
  });

  it('persiste a edição e substitui somente a tarefa correspondente sem mutar a coleção', async () => {
    const outra: Tarefa = { ...nova, _id: 'outra', titulo: 'Outra tarefa' };
    vi.mocked(listarTarefas).mockResolvedValue([antiga, outra]);
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.tarefas).toEqual([antiga, outra]));
    const colecaoAnterior = result.current.tarefas;
    const tarefaEditada = { ...antiga, titulo: 'Título atualizado' };

    await act(async () => { await result.current.editarTarefa(tarefaEditada); });

    expect(alterarTarefa).toHaveBeenCalledWith('antiga', { ...nova, titulo: 'Título atualizado' });
    expect(result.current.tarefas).not.toBe(colecaoAnterior);
    expect(result.current.tarefas).toEqual([tarefaEditada, outra]);
    expect(result.current.tarefas[1]).toBe(outra);
  });

  it('mantém os dados anteriores quando a persistência da edição falha', async () => {
    vi.mocked(alterarTarefa).mockRejectedValue(new Error('HTTP 500'));
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await expect(result.current.editarTarefa({ ...antiga, titulo: 'Não salvar' }))
        .rejects.toThrow('Não foi possível confirmar a edição');
    });

    expect(result.current.tarefas).toEqual([antiga]);
    expect(result.current.erro).toContain('Não foi possível confirmar a edição.');
  });

  it('só remove o registro depois da confirmação do DELETE', async () => {
    const exclusao = pendente<void>();
    vi.mocked(excluirTarefa).mockReturnValue(exclusao.promise);
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    let operacao!: Promise<void>;
    act(() => { operacao = result.current.removerTarefa('antiga'); });
    expect(result.current.tarefas).toEqual([antiga]);
    await act(async () => { exclusao.resolver(); await operacao; });
    expect(result.current.tarefas).toEqual([]);
    expect(excluirTarefa).toHaveBeenCalledWith('antiga');
  });

  it('preserva a tarefa e informa o erro quando a exclusão falha', async () => {
    vi.mocked(excluirTarefa).mockRejectedValue(new Error('HTTP 404'));
    const { result } = renderHook(useTarefas, { wrapper });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { await result.current.removerTarefa('antiga'); });
    expect(result.current.tarefas).toEqual([antiga]);
    expect(result.current.erro).toContain('Não foi possível confirmar a exclusão.');
  });

  it('preserva criações que terminam antes do carregamento inicial, sem duplicar _id', async () => {
    const carga = pendente<Tarefa[]>();
    vi.mocked(listarTarefas).mockReturnValue(carga.promise);
    const { result } = renderHook(useTarefas, { wrapper });
    await act(async () => { await result.current.adicionarTarefa(nova); });
    await act(async () => { carga.resolver([antiga, criada]); });
    expect(result.current.tarefas).toEqual([criada, antiga]);
  });

  it('ignora a resposta obsoleta do ciclo de limpeza do StrictMode', async () => {
    const primeira = pendente<Tarefa[]>();
    vi.mocked(listarTarefas).mockReturnValueOnce(primeira.promise).mockResolvedValueOnce([criada]);
    const { result } = renderHook(useTarefas, {
      wrapper,
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.tarefas).toEqual([criada]));
    expect(vi.mocked(listarTarefas).mock.calls[0][0]?.aborted).toBe(true);
    await act(async () => { primeira.resolver([antiga]); });
    expect(result.current.tarefas).toEqual([criada]);
  });

  it('compartilha uma única coleção entre consumidores diferentes', async () => {
    let adicionar!: (tarefa: NovaTarefa) => Promise<void>;
    function Consumidor({ nome }: { nome: string }) {
      const contexto = useTarefas();
      adicionar = contexto.adicionarTarefa;
      return <output aria-label={nome}>{contexto.tarefas.length}</output>;
    }
    render(<TarefasProvider><Consumidor nome="pagina" /><Consumidor nome="modal" /></TarefasProvider>);
    await waitFor(() => expect(screen.getByLabelText('pagina')).toHaveTextContent('1'));
    await act(async () => { await adicionar(nova); });
    expect(screen.getByLabelText('pagina')).toHaveTextContent('2');
    expect(screen.getByLabelText('modal')).toHaveTextContent('2');
    expect(listarTarefas).toHaveBeenCalledTimes(1);
  });

  it('informa quando o hook é utilizado fora do provider', () => {
    expect(() => renderHook(useTarefas)).toThrow('dentro de TarefasProvider');
  });
});
