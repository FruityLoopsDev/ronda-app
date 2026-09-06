// matches.ts: Lógica Post-Evento (Matches mutuos y Chat 72h)

export interface LikeRecord {
  id?: string;
  from: string;
  to: string;
  like: boolean;
}

export interface MutualMatch {
  u1: string;
  u2: string;
  timestamp: number;
}

export interface MutualMatchPair {
  user1: string;
  user2: string;
}

export interface TemporaryChat {
  chatId: string;
  participants: string[];
  expiresAt: number;
  messages: unknown[];
}

export interface ReturnCoupon {
  code: string;
  discount: string;
  validUntil: number;
}

class MatchServiceImpl {
  likes: Map<string, Set<string>>;
  constructor() {
    this.likes = new Map(); // uid -> Set(likedUids)
  }

  // Cliente emite un 'Like' hacia otro participante
  likeParticipant(myUid: string, targetUid: string): void {
    if (!this.likes.has(myUid)) {
      this.likes.set(myUid, new Set());
    }
    this.likes.get(myUid)!.add(targetUid);
    console.log(`${myUid} le dio Like a ${targetUid}`);
  }

  // Al finalizar el evento, calcula los matches mutuos
  calculateMutualMatches(participants: { uid: string }[]): MutualMatch[] {
    const mutualMatches: MutualMatch[] = [];

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const u1 = participants[i].uid;
        const u2 = participants[j].uid;

        const u1LikesU2 = this.likes.has(u1) && this.likes.get(u1)!.has(u2);
        const u2LikesU1 = this.likes.has(u2) && this.likes.get(u2)!.has(u1);

        if (u1LikesU2 && u2LikesU1) {
          mutualMatches.push({ u1, u2, timestamp: Date.now() });
        }
      }
    }

    console.log("Matches mutuos encontrados:", mutualMatches);
    return mutualMatches;
  }

  // Calcula matches mutuos a partir de lista de likes ($0 sin Cloud Functions)
  // SEGURIDAD: se prefiere derivar `from` del `id` del documento (
  // prefijo `{uid}_{target}` ya autenticado por las reglas de Firestore),
  // no del cuerpo (`item.from`), que el emisor podría falsear.
  findMutualMatchesFromLikes(likesList: LikeRecord[]): MutualMatchPair[] {
    const likeMap = new Map<string, boolean>();
    for (const item of likesList) {
      if (item.like !== true || !item.to) continue;
      const to = item.to;
      const from = (typeof item.id === 'string' ? item.id.split('_')[0] : null) || item.from;
      if (!from || from === to) continue;
      likeMap.set(`${from}_${to}`, true);
    }

    const matches: MutualMatchPair[] = [];
    likeMap.forEach((_, key) => {
      const [from, to] = key.split('_');
      if (likeMap.has(`${to}_${from}`)) {
        if (from < to) {
          matches.push({ user1: from, user2: to });
        }
      }
    });

    console.log(`[Matches] ${matches.length} matches mutuos identificados de ${likesList.length} votos.`);
    return matches;
  }

  // Simulación de creación de chat que expira en 72h
  createTemporaryChat(match: MutualMatch): TemporaryChat {
    const expiration = match.timestamp + (72 * 60 * 60 * 1000);
    return {
      chatId: `chat_${match.u1}_${match.u2}`,
      participants: [match.u1, match.u2],
      expiresAt: expiration,
      messages: []
    };
  }

  // Simulación de cupón para volver si no hubo match
  generateReturnCoupon(userId: string): ReturnCoupon {
    console.log(`Generando cupón de descuento para ${userId} por 0 matches.`);
    return {
      code: `VUELVE-${userId.substring(0,4).toUpperCase()}-50`,
      discount: '50%',
      validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 días
    };
  }
}

export const Matches = new MatchServiceImpl();
