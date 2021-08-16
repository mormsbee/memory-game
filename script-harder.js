var lib = {
	// a quick function for building elements, setting attributes and properties, and appending child elements "inline"
	make: function (tag, params) {
		var elem = document.createElement(tag);
		if (elem && params) {
			for (var attr in params.attribs) {
				if (!params.attribs.hasOwnProperty(attr)) continue;
				elem.setAttribute(attr, params.attribs[attr]);
			}
			for (var prop in params.props){
				if (!params.props.hasOwnProperty(prop)) continue;
				elem[prop] = params.props[prop];
			}

			if (params.child) lib.push(elem, params.child);
			if (params.children) lib.pushArray(elem, params.children);
		}
		return elem;
	},
	// used to treat the act of appending a child like pushing with an array
	push: function (parent, child) {
		parent.appendChild(child);
		return parent;
	},
	// used to push an array of elements into another element
	pushArray: function (parent, children) {
		children.forEach(function (child) {
			lib.push(parent, child);
		});
		return parent;
	},
	// used to find the first matching object in an array
	findFirstMatchInArray: function (haystack, needleTest) {
		// using findIndex() instead of find() because it breaks like a for loop as soon as a match is found
		var index = haystack.findIndex(needleTest);
		return index !== -1 ? haystack[index] : false;
	},
	// not my code. found this here: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
	shuffle: function (array) {
		var currentIndex = array.length, temporaryValue, randomIndex;
		// While there remain elements to shuffle...
		while (0 !== currentIndex) {
			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;
			// And swap it with the current element.
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}
		return array;
	}
};

var memoryGame = function () {

	// if it is not logic, let's keep it in here.
	this.db = {
		numCards: 12,
		cards: [],
		flipped: [],
		known: [],
		matched: [],
		score: {player: 0, computer: 0},
		lockUserInput: false,
		activeStep: false
	};
	
	this.init = function () {

		// Get a handle on the stage
		this.stage = {
			elem: document.getElementById('stage')
		};

		// Get handles on the hud and some other elements for displaying info
		this.hud = {
			elem: document.getElementById('hud'),
			step: {
				elem: document.getElementById('step')
			},
			score: {
				player: {
					elem: document.getElementById('player-score')
				},
				computer: {
					elem: document.getElementById('computer-score')
				}
			}
		};

		// Create all of the cards, two of each value
		for (var i = 0; i < this.db.numCards / 2; i++) {
			this.db.cards.push(new this.card(i + 1));
			this.db.cards.push(new this.card(i + 1));
		}

		// Shuffle the cards
		this.db.cards = lib.shuffle(this.db.cards);

		// Add the cards to the stage
		this.db.cards.forEach(function (card, index) {

			// create the card and some wrappers and push it onto the stage
			lib.push(this.stage.elem, lib.make('div', {
				attribs: {'class': 'slot'},
				child: lib.make('div', {
					attribs: {'class': 'card-wrapper dead-center'},
					child: card.elem
				})
			}));

			// set the "grid" index on the card so we can search with it later
			this.db.cards[index].index = index;

			// add a hook for the card back to the game so we can access it from inside card events
			this.db.cards[index].game = this;

		}, this);

		// Set initial game state and messaging.
		this.step('player-flip-2');
	};

	this.reset = function () {
		this.db.flipped = [];
		this.db.cards.forEach(function (card) {
			if (card.flipped && !card.matched) card.flip(true);
			card.blur(true);
		});
	};

	this.flip = function (card) {
		this.db.flipped.push(card);
		this.addCardToList('known', card);
		card.known = true;
		card.flipped = true;
	};

	this.lock = function () {
		this.db.lockUserInput = true;
	};

	this.unlock = function () {
		this.db.lockUserInput = false;
	};

	this.focus = function (card) {
		card = card || this.findFirstAvailableCard();
		card && card.focus();
	};

	this.findFirstAvailableCard = function (shuffle) {
		// if shuffle is set, use a shuffle cloned array
		var availableCards = shuffle ? lib.shuffle(this.db.cards.slice(0)) : this.db.cards;

		// return the first card from those available that are not already matched or selected
		return lib.findFirstMatchInArray(availableCards, function (card) { 
			return !card.matched && !card.flipped;
		});
	};

	this.testMatch = function () {
		return this.db.flipped.length == 2 && this.db.flipped[0].value === this.db.flipped[1].value;
	};

	this.addCardToList = function (name, card) {
		// only add it to the list if we don't find a match for it within the list already.
		if (!lib.findFirstMatchInArray(this.db[name], function (item) {
			return item.value === card.value && item.index === card.index;
		})) {
			this.db[name].push(card);
		}
	};

	this.step = function (name, args) {
		if (!this.steps[name]) return false;

		this.hud.step.elem.innerText = this.steps[name].message;
		if (typeof this.steps[name].do === 'function') {
			this.steps[name].do(this, args);
		}
	};

	this.select = function (card, byComputer) {
		this.step('flipped', {card: card, player: byComputer ? 'computer' : 'player'});
	};

	// The logic for gameplay.
	this.steps = {

		// Player's turn, first card flip
		'player-flip-2': {message: 'Flip 2 cards.', do: function (self) {
			self.reset();
			self.unlock();
			self.focus();
		}},

		// Player's turn second card flip
		'player-flip-1': {message: 'Flip 1 card.', do: function (self) {
			self.unlock();
		}},

		// Computer's turn, first card flip
		'computer-flip-2': {message: 'Please wait. Computer is flipping 2 cards.', do: function (self) {
			setTimeout(function () {

				var targetCard = false;

				// search known to see if there are any matches within known already				
				var search = self.db.known.filter(function (card) { return !card.matched; });
				for (var item in search) {// for loop so we can break as soon as possible
					targetCard = search.filter(function (test) { 
						return search[item].index !== test.index && search[item].value === test.value;
					})[0];
					if (targetCard) break;
				}

				// if we didn't find a match within known, let's try to pick one that is NOT already known
				targetCard = targetCard || self.db.cards.filter(function (card) { 
					return !card.matched && !card.known; 
				})[0];

				// if we couldn't pick one that isn't known, just pick the first available at random 
				targetCard = targetCard || self.findFirstAvailableCard(true);
				
				// if we have a targetCard, flip it!
				if (targetCard) targetCard.flip(true, true);
				
			}, 1000);
		}},

		// Computer's turn, second card flip
		'computer-flip-1': {message: 'Please wait. Computer is flipping 1 card.', do: function (self) {
			setTimeout(function () {

				var flippedCard = self.db.flipped[0];
				var targetCard = false;

				// Let's check to see if we already know where the match is for the card that was just selected
				var knownMatch = self.db.known.findIndex(function (card) {
					return !card.matched && !card.flipped && card.index !== flippedCard.index && card.value === flippedCard.value;
				});
				if (knownMatch !== -1) targetCard = self.db.known[knownMatch];

				// if we didn't find a match for the flipped card in known, let's make sure that we don't pick one from known
				targetCard = targetCard || self.db.cards.filter(function (card) { 
					return !card.matched && !card.known && !card.flipped; 
				})[0];

				// otherwise let's choose a card at random to flip
				targetCard = targetCard || self.findFirstAvailableCard(true);
				
				// if we have a targetCard, flip it!
				if (targetCard) targetCard.flip(true, true);

			}, 1000);
		}},

		// A card has been flipped
		'flipped': {message: '', do: function (self, args) {
			self.lock();
			self.flip(args.card);

			if (self.db.flipped.length === 1) {
				self.step(args.player + '-flip-1');
			} else if (self.testMatch()) {
				self.step('matched', args.player);
			} else {
				self.step('mismatched', args.player);
			}
		}},

		// A match was found
		'matched': {message: 'A match was found!', do: function (self, player) {
			self.db.score[player]++;
			self.hud.score[player].elem.innerText = self.db.score[player];

			self.db.flipped.forEach(function (card) {
				card.elem.classList.add('matched', player);
				self.addCardToList('matched', card);
				card.matched = true;
			});

			self.reset();

			setTimeout(function () {
				self.step('test-end', player);
			}, 1500);
		}},

		// 2 cards flipped, no match found
		'mismatched': {message: 'Cards do not match.', do: function (self, player) {
			setTimeout(function () {
				self.reset();
				self.step((player == 'player' ? 'computer' : 'player') + '-flip-2');
			}, 1500);
		}},

		// Computer's turn, card match found
		'test-end': {message: '', do: function (self, player) {
			if (self.db.matched.length !== self.db.cards.length) {
				self.step(player + '-flip-2');
			} else {
				var score = self.db.score;
				var step = score.player > score.computer ? 'you-win' : (score.player < score.computer ? 'you-lose' : 'you-tied');
				self.step(step);
			}
		}},

		'you-win': {message: 'You Win! Refresh your browser to play again.'},
		'you-lose': {message: 'You Lose. Refresh your browser to try again.'},
		'you-tied': {message: 'You Tied. Refresh your browser to play again.'},
	};

	this.card = function (value) {
		this.value = value;
		this.index = 0;
		this.matched = false;
		this.flipped = false;
		this.known = false;

		this.elem = lib.make('div', {
			attribs: {
				'class': 'card value-' + value,
				'tabindex': 0
			},
			props: {
				card: this,
				ontouchstart: function () {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.flip();
				},
				onmousedown: function(e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
				},
				onmouseup: function () {
					this.card.flip();
				},
				onmouseenter: function () {
					this.card.focus();
				},
				onfocus: function (e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.focus();
				},
				onblur: function (e) {
					this.card.blur();
				},
				onmouseout: function () {
					this.card.blur();
				},
				onkeydown: function (e) {
					if (this.card.game.db.lockUserInput) {
						e.preventDefault();
						return false;
					}
					this.card.keyup(e.keyCode, this.card.index);
				}
			},
			child: lib.make('div', {
    			attribs: {'class': 'content'},
    			children: [
    				lib.make('div', { 
    					attribs: {'class': 'front'}
    				}),
    				lib.make('div', {
						attribs: {'class': 'back'},
						child: lib.make('div', {
							attribs: {'class': 'dead-center'},
							// use this.value instead of '' if you want to insert the value onto the back of the card.
							props: {'innerText': ''}
						})
					})
    			]
    		})
		});

		this.keyup = function (keyCode, index) {
			/*
			TODO: in the logic below we are calculating new indexes with numCardsPerRow of 4 because our rows are 4 across.  
			If we were to change layout, i.e number of rows, we would potentially need to update some logic here.
			*/

			if (this.game.db.lockUserInput) return false;

			//space: 32, enter: 13, left: 37, up: 38, right: 39, down: 40
			if (keyCode == 32 || keyCode == 13) {
				this.flip();
			} else {
				var cards = this.game.db.cards;
				var count = cards.length;
				var maxIndex = count - 1;
				var numCardsPerRow = 4;

				// left arrow
				if (keyCode == 37) {
					index = (index === 0) ? maxIndex : index - 1;
				}
				// right arrow
				if (keyCode == 39) {
					index = (index == maxIndex) ? 0 : index + 1;
				}
				// up arrow
				if (keyCode == 38) {
					index = index === 0 ? maxIndex : (index - numCardsPerRow >= 0 ? index - numCardsPerRow : index - numCardsPerRow + maxIndex);
				}
				// down arrow
				if (keyCode == 40) {
					index = index === maxIndex ? 0 : (index + numCardsPerRow <= maxIndex ? index + numCardsPerRow : index + numCardsPerRow - maxIndex);
				}

				cards[index].focus();
			}
		};

		this.blur = function (skipLock) {
			if (!skipLock && this.game.db.lockUserInput) return false;
			this.elem.classList.remove('focused');
			this.elem.blur();
		};

		this.focus = function () {
			if (this.game.db.lockUserInput) return false;
			this.elem.classList.add('focused');
			this.elem.focus();
		};

		this.flip = function (skipLock, byComputer) {
			if (this.matched) return false;
			if (!skipLock && this.flipped) return false;
			if (!skipLock && this.game.db.lockUserInput) return false;

			this.elem.classList.toggle('flip');
			this.flipped = this.elem.classList.contains('flip');

			if (this.flipped) {
				this.game.select(this, byComputer);
			}
		};
	};

	this.init();
};

new memoryGame();