// matches.js: Lógica Post-Evento (Matches mutuos y Chat 72h)

class MatchServiceImpl {
  likes: Map<string, Set<string>>;
  constructor() {
    this.likes = new Map(); // uid -> Set(likedUids)
  }

  // Cliente emite un 'Like' hacia otro participante
  likeParticipant(myUid, targetUid) {
    if (!this.likes.has(myUid)) {
      this.likes.set(myUid, new Set());
    }
    this.likes.get(myUid).add(targetUid);
    console.log(`${myUid} le dio Like a ${targetUid}`);
  }

  // Al finalizar el evento, calcula los matches mutuos
  calculateMutualMatches(participants) {
    const mutualMatches = [];
    
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const u1 = participants[i].uid;
        const u2 = participants[j].uid;
        
        const u1LikesU2 = this.likes.has(u1) && this.likes.get(u1).has(u2);
        const u2LikesU1 = this.likes.has(u2) && this.likes.get(u2).has(u1);
        
        if (u1LikesU2 && u2LikesU1) {
          mutualMatches.push({ u1, u2, timestamp: Date.now() });
        }
      }
    }
    
    console.log("Matches mutuos encontrados:", mutualMatches);
    return mutualMatches;
  }

  // Calcula matches mutuos a partir de lista de likes ($0 sin Cloud Functions)
  findMutualMatchesFromLikes(likesList: { from: string; to: string; like: boolean }[]): { user1: string; user2: string }[] {
    const likeMap = new Map<string, boolean>();
    for (const item of likesList) {
      if (item.like === true && item.from && item.to) {
        likeMap.set(`${item.from}_${item.to}`, true);
      }
    }

    const matches: { user1: string; user2: string }[] = [];
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
  createTemporaryChat(match) {
    const expiration = match.timestamp + (72 * 60 * 60 * 1000);
    return {
      chatId: `chat_${match.u1}_${match.u2}`,
      participants: [match.u1, match.u2],
      expiresAt: expiration,
      messages: []
    };
  }

  // Simulación de cupón para volver si no hubo match
  generateReturnCoupon(userId) {
    console.log(`Generando cupón de descuento para ${userId} por 0 matches.`);
    return {
      code: `VUELVE-${userId.substring(0,4).toUpperCase()}-50`,
      discount: '50%',
      validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 días
    };
  }
}

export const Matches = new MatchServiceImpl();
