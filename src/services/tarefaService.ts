import axios from 'axios';
import type { NovaTarefa, Tarefa } from '../types/Tarefa';

const RECURSO = '/tarefas';

export class ConfiguracaoApiError extends Error {
  constructor() {
    super('Configure VITE_API_URL no arquivo .env com um endpoint válido do CrudCrud e reinicie o servidor.');
    this.name = 'ConfiguracaoApiError';
  }
}

function obterApi() {
  const baseURL = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  if (!baseURL || baseURL.includes('SEU_ENDPOINT')) throw new ConfiguracaoApiError();

  try {
    const url = new URL(baseURL);
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.pathname.endsWith(RECURSO)) {
      throw new ConfiguracaoApiError();
    }
  } catch {
    throw new ConfiguracaoApiError();
  }

  return axios.create({ baseURL, timeout: 15000 });
}

function ehTarefaPersistida(valor: unknown): valor is Tarefa & { _id: string } {
  if (!valor || typeof valor !== 'object') return false;
  const tarefa = valor as Record<string, unknown>;
  return typeof tarefa._id === 'string' && tarefa._id.length > 0
    && typeof tarefa.titulo === 'string'
    && typeof tarefa.descricao === 'string'
    && typeof tarefa.data === 'string'
    && ['high', 'medium', 'low'].includes(String(tarefa.prioridade))
    && typeof tarefa.projeto === 'string'
    && typeof tarefa.concluida === 'boolean';
}

export async function listarTarefas(signal?: AbortSignal): Promise<Tarefa[]> {
  const resposta = await obterApi().get<unknown>(RECURSO, { signal });
  if (!Array.isArray(resposta.data) || !resposta.data.every(ehTarefaPersistida)) {
    throw new Error('A API retornou uma lista de tarefas inválida.');
  }
  return resposta.data;
}

export async function criarTarefa(tarefa: NovaTarefa): Promise<Tarefa> {
  // O identificador é gerado pelo CrudCrud, nunca enviado pelo formulário.
  const { titulo, descricao, data, prioridade, projeto, concluida } = tarefa;
  const resposta = await obterApi().post<unknown>(RECURSO, {
    titulo, descricao, data, prioridade, projeto, concluida,
  });
  if (!ehTarefaPersistida(resposta.data)) {
    throw new Error('A API não retornou a tarefa com o identificador esperado.');
  }
  return resposta.data;
}

export async function alterarTarefa(id: string, tarefa: NovaTarefa): Promise<Tarefa> {
  if (!id.trim()) throw new Error('Informe o identificador da tarefa para atualizar.');
  await obterApi().put(`${RECURSO}/${encodeURIComponent(id)}`, tarefa);
  return { ...tarefa, _id: id };
}

export async function excluirTarefa(id: string): Promise<void> {
  if (!id.trim()) throw new Error('Informe o identificador da tarefa para excluir.');
  await obterApi().delete(`${RECURSO}/${encodeURIComponent(id)}`);
}
