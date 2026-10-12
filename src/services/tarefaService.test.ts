import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { alterarTarefa, ConfiguracaoApiError, criarTarefa, excluirTarefa, listarTarefas } from './tarefaService';
import type { NovaTarefa } from '../types/Tarefa';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('axios', () => ({ default: { create: vi.fn(() => api) } }));

const nova: NovaTarefa = {
  titulo: 'Revisar atividade', descricao: 'Conferir requisitos', data: '2026-11-09',
  prioridade: 'high', projeto: 'TaskFlow', concluida: false,
};
const salva = { ...nova, _id: 'id-do-servidor' };

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'https://crudcrud.com/api/endpoint-de-teste/');
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('tarefaService', () => {
  it('carrega /tarefas com a URL configurada e permite cancelar a requisição', async () => {
    api.get.mockResolvedValue({ data: [salva] });
    const controller = new AbortController();
    await expect(listarTarefas(controller.signal)).resolves.toEqual([salva]);
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: 'https://crudcrud.com/api/endpoint-de-teste', timeout: 15000,
    });
    expect(api.get).toHaveBeenCalledWith('/tarefas', { signal: controller.signal });
  });

  it('envia POST sem _id e retorna o identificador produzido pelo servidor', async () => {
    api.post.mockResolvedValue({ data: salva });
    await expect(criarTarefa({ ...nova, ...{ _id: 'nao-enviar' } })).resolves.toEqual(salva);
    expect(api.post).toHaveBeenCalledWith('/tarefas', nova);
  });

  it('atualiza pelo identificador existente e devolve a tarefa com o mesmo _id', async () => {
    api.put.mockResolvedValue({ status: 200 });
    const alterada = { ...nova, titulo: 'Revisar requisitos' };
    await expect(alterarTarefa('id/seguro', alterada)).resolves.toEqual({ ...alterada, _id: 'id/seguro' });
    expect(api.put).toHaveBeenCalledWith('/tarefas/id%2Fseguro', alterada);
  });

  it('impede atualização sem identificador', async () => {
    await expect(alterarTarefa(' ', nova)).rejects.toThrow('identificador');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('exclui pelo identificador sem exigir corpo na resposta DELETE', async () => {
    api.delete.mockResolvedValue({ status: 200 });
    await expect(excluirTarefa('id/seguro')).resolves.toBeUndefined();
    expect(api.delete).toHaveBeenCalledWith('/tarefas/id%2Fseguro');
  });

  it.each(['', 'https://crudcrud.com/api/SEU_ENDPOINT', 'endereco-invalido', 'javascript:alert(1)', 'https://crudcrud.com/api/teste/tarefas'])('rejeita configuração inválida: %s', async (url) => {
    vi.stubEnv('VITE_API_URL', url);
    await expect(listarTarefas()).rejects.toBeInstanceOf(ConfiguracaoApiError);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('não aceita HTML ou objetos no lugar da coleção da API', async () => {
    api.get.mockResolvedValue({ data: '<html>Resposta incorreta</html>' });
    await expect(listarTarefas()).rejects.toThrow('lista de tarefas inválida');
  });

  it('não aceita cadastro sem o _id da persistência', async () => {
    api.post.mockResolvedValue({ data: nova });
    await expect(criarTarefa(nova)).rejects.toThrow('identificador esperado');
  });

  it('preserva falhas HTTP para o contexto tratar', async () => {
    const falha = new Error('Endpoint expirado');
    api.post.mockRejectedValue(falha);
    await expect(criarTarefa(nova)).rejects.toBe(falha);
  });

  it('impede exclusão sem identificador', async () => {
    await expect(excluirTarefa(' ')).rejects.toThrow('identificador');
    expect(api.delete).not.toHaveBeenCalled();
  });
});
