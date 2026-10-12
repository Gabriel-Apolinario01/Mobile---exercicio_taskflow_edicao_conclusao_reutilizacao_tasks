import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { alterarTarefa as persistirAlteracao, ConfiguracaoApiError, criarTarefa, excluirTarefa, listarTarefas } from '../services/tarefaService';
import type { NovaTarefa, Tarefa } from '../types/Tarefa';

type TarefasContextType = {
  tarefas: Tarefa[];
  carregando: boolean;
  erro: string;
  adicionarTarefa: (novaTarefa: NovaTarefa) => Promise<void>;
  editarTarefa: (tarefa: Tarefa) => Promise<void>;
  removerTarefa: (id: string) => Promise<void>;
};

const TarefasContext = createContext<TarefasContextType | null>(null);

export function TarefasProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;

    async function carregarTarefas() {
      try {
        const dados = await listarTarefas(controller.signal);
        if (ativo) {
          // Um POST pode terminar antes do GET inicial: preserve a tarefa recém-criada.
          setTarefas((atuais) => [
            ...atuais,
            ...dados.filter((dado) => !atuais.some((tarefa) => tarefa._id === dado._id)),
          ]);
        }
      } catch (causa) {
        if (ativo) {
          setErro(causa instanceof ConfiguracaoApiError
            ? causa.message
            : 'Não foi possível carregar as tarefas. O serviço pode estar temporariamente indisponível. Recarregue a página; se o erro continuar, confira a conexão e a validade do endpoint do CrudCrud.');
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarTarefas();
    return () => {
      ativo = false;
      controller.abort();
    };
  }, []);

  async function adicionarTarefa(novaTarefa: NovaTarefa): Promise<void> {
    try {
      setErro('');
      const tarefaCriada = await criarTarefa(novaTarefa);
      setTarefas((atuais) => [tarefaCriada, ...atuais]);
    } catch (causa) {
      const mensagem = causa instanceof ConfiguracaoApiError
        ? causa.message : 'Não foi possível confirmar o cadastro. Abra Todas as tarefas e recarregue a página antes de tentar novamente: a tarefa pode ter sido salva. Se o erro continuar, confira a conexão e a disponibilidade ou validade do endpoint do CrudCrud.';
      setErro(mensagem);
      // O TaskForm trata a rejeição; o TaskModal só fecha após o sucesso.
      throw new Error(mensagem, { cause: causa });
    }
  }

  async function editarTarefa(tarefa: Tarefa): Promise<void> {
    const { _id, ...dadosTarefa } = tarefa;
    if (!_id) throw new Error('A tarefa não possui identificador para atualização.');

    try {
      setErro('');
      const tarefaAtualizada = await persistirAlteracao(_id, dadosTarefa);
      setTarefas((atuais) => atuais.map((atual) => atual._id === _id ? tarefaAtualizada : atual));
    } catch (causa) {
      const mensagem = causa instanceof ConfiguracaoApiError
        ? causa.message : 'Não foi possível confirmar a edição. Recarregue a página antes de tentar novamente: as alterações podem ter sido salvas. Se o erro continuar, confira a conexão e a disponibilidade ou validade do endpoint do CrudCrud.';
      setErro(mensagem);
      throw new Error(mensagem, { cause: causa });
    }
  }

  async function removerTarefa(id: string): Promise<void> {
    try {
      setErro('');
      await excluirTarefa(id);
      setTarefas((atuais) => atuais.filter((tarefa) => tarefa._id !== id));
    } catch (causa) {
      // Como na aula, o erro fica disponível ao consumidor sem remover o registro.
      setErro(causa instanceof ConfiguracaoApiError
        ? causa.message : 'Não foi possível confirmar a exclusão. Recarregue a página antes de tentar novamente: a tarefa pode ter sido excluída. Se o erro continuar, confira a conexão e a disponibilidade ou validade do endpoint do CrudCrud.');
    }
  }

  return (
    <TarefasContext.Provider value={{ tarefas, carregando, erro, adicionarTarefa, editarTarefa, removerTarefa }}>
      {children}
    </TarefasContext.Provider>
  );
}

export function useTarefas() {
  const contexto = useContext(TarefasContext);
  if (!contexto) throw new Error('useTarefas deve ser utilizado dentro de TarefasProvider.');
  return contexto;
}
