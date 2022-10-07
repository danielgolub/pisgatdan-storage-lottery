async function fetchData() {
  const [allApts, allStorages] = await Promise.all([
    $.get('./sizes.csv'),
    $.get('./storages.csv'),
  ]);

  const sizesOrigin = allApts
    .split('\n')
    .reduce((all, i) => {
      const [aptNum,, rooms,, size,, belSize, parkingLevel] = i.split('\t');
      return {
        ...all,
        [aptNum]: {
          size: parseFloat(size, 10) + parseFloat(belSize) / 2,
          parkingLevel: parseInt(parkingLevel, 10),
          rooms,
        },
      };
    }, {});
  const storages = allStorages
    .split('\n')
    .reduce((all, line, i) => {
      if (i === 0) return all;

      const [name, size, level] = line.split(',');
      return [
        ...all,
        {
          name,
          size: parseFloat(size, 10),
          level: parseInt(level.replace('\r', ''), 10),
        },
      ];
    }, [])
    .sort(({ level: aLevel }, { level: bLevel }) => bLevel - aLevel);

  return [sizesOrigin, storages];
}

function lottery(storages, sizes, spacePerMeter) {
  storages.forEach((room) => {
    let counter = 0;
    let size;
    let rooms;
    let apts = [];
    const skippables = (apt) => apts.includes(apt);
    const biggerAptThenLeftRoomSpace = (apt) => counter + sizes[apt].size * spacePerMeter > room.size;
    const notSameParkingLevel = (apt, level) => (level ? sizes[apt].parkingLevel !== level : sizes[apt].parkingLevel !== room.level);
    const notSameSizeMeters = (apt) => size && sizes[apt].size !== size;
    const notSameSizeRooms = (apt, loopRooms) => (loopRooms ? sizes[apt].rooms !== loopRooms : rooms && sizes[apt].rooms !== rooms);
    const action = (apt) => {
      size = sizes[apt].size;
      rooms = sizes[apt].rooms;
      counter += sizes[apt].size * spacePerMeter;
      return true;
    };
    apts = apts.concat(Object.keys(sizes).filter((apt) => {
      if (skippables(apt) || biggerAptThenLeftRoomSpace(apt) || notSameParkingLevel(apt) || notSameSizeRooms(apt) || notSameSizeMeters(apt)) {
        return false;
      }
      return action(apt);
    }));
    apts = apts.concat(Object.keys(sizes).filter((apt) => {
      if (skippables(apt) || biggerAptThenLeftRoomSpace(apt) || notSameParkingLevel(apt) || notSameSizeRooms(apt)) {
        return false;
      }
      return action(apt);
    }));
    apts = apts.concat(Object.keys(sizes).filter((apt) => {
      if (skippables(apt) || biggerAptThenLeftRoomSpace(apt) || notSameParkingLevel(apt)) {
        return false;
      }
      return action(apt);
    }));
    apts = apts.concat(Object.keys(sizes).filter((apt) => {
      if (skippables(apt) || biggerAptThenLeftRoomSpace(apt)) {
        return false;
      }
      return action(apt);
    }));

    room.totalOccupied = counter;
    room.apts = apts.map((apt) => ({
      num: apt,
      size: (sizes[apt].size * spacePerMeter).toFixed(3),
      totalSize: sizes[apt].size,
      rooms: sizes[apt].rooms,
      parkingLevel: sizes[apt].parkingLevel,
    }));
    apts.forEach((apt) => {
      delete sizes[apt];
    });
  });

  const leftApts = Object.keys(sizes);
  if (leftApts.length) {
    storages.forEach((room) => {
      const apt = leftApts.pop();
      if ((!apt && !leftApts.length)) {
        return;
      }
      room.totalOccupied += sizes[apt].size * spacePerMeter;
      room.apts.push({
        num: apt,
        size: (sizes[apt].size * spacePerMeter).toFixed(3),
        totalSize: sizes[apt].size,
        rooms: sizes[apt].rooms,
        parkingLevel: sizes[apt].parkingLevel,
      });
      delete sizes[apt];

      console.log('pushed apt ', {
        apt,
        room: room.name,
      });
    });
  }
  console.log('left apts', { leftApts });
}

function displayLottery(storages, totalArea, totalStorages, spacePerMeter) {
  const storageHtml = storages.map((room) => {
    const storageIds = room.apts.map((apt, i) => {
      let tr = `<tr class="item-${i}">`;
      if (i === 0) {
        tr += `
                <td class="text-center" rowspan="${room.apts.length}">מחסן ${room.name}</td>
                <td class="text-center" rowspan="${room.apts.length}">מינוס ${room.level}</td>
                <td class="text-center" rowspan="${room.apts.length}">${room.size.toFixed(3)} מ״ר</td>`;
      }
      tr += `
                                <td class="text-center">${apt.num}</td>
                                <td class="text-center">${apt.rooms} חדרים</td>
                                <td class="text-center">${apt.totalSize.toFixed(3)} מ״ר</td>
                                <td class="text-center">${parseFloat(apt.size).toFixed(3)} מ״ר</td>
            `;
      if (i === 0) {
        tr += `<td class="text-center" rowSpan="${room.apts.length}">${room.totalOccupied.toFixed(3)} מ״ר</td>`;
      }
      return `${tr}</tr>`;
    }).join('\n');
    return storageIds;
  }).join('\n');

  const cardBody = document.querySelector('.card-body');
  cardBody.innerHTML = `
      
      <ul>
      	<li>סה״כ שטח מרצפות: ${totalArea} מ״ר</li>
        <li>סה״כ שטח מחסנים: ${totalStorages} מ״ר</li>
        <li>סה״כ שטח מחסן למטר מרצפת: ${spacePerMeter} מ״ר</li>
      </ul>
      <table class="table table-bordered">
        <thead class="table-dark" style="position: sticky;top: 0">
            <tr>
                <th>מספר מחסן</th>
                <th>מפלס מחסן</th>
                <th>סה״כ שטח במחסן</th>
                <th>מספר דירה</th>
                <th>כמות חדרים</th>
                <th>גודל דירה</th>
                <th>זכות במחסן</th>
                <th>סה״כ שטח מחסן מנוצל</th>
            </tr>
        </thead>
        <tbody>
        ${storageHtml}
        </tbody>
    </table>
      `;
}

async function start() {
  const [sizesOrigin, storages] = await fetchData();

  const totalArea = Object.values(sizesOrigin)
    .reduce((all, { size: num }) => all + num, 0)
    .toFixed(3);
  const totalStorages = parseInt(
    storages.reduce((all, { size: num }) => all + parseFloat(num), 0),
    10,
  ).toFixed(3);
  const spacePerMeter = (totalStorages / totalArea).toFixed(5);

  console.log('stats', {
    totalArea,
    totalStorages,
    spacePerMeter,
    storages,
  });

  const submit = document.querySelector('#submit');
  submit.addEventListener('click', async () => {
    // eslint-disable-next-line
    const sizes = _.shuffle(Object.keys(sizesOrigin))
      .reduce((all, apt) => ({
        ...all,
        [`דירה ${apt}`]: sizesOrigin[apt],
      }), {});

    console.log('shuffled apts', sizes);

    document.querySelector('.card').className = 'card';

    lottery(storages, sizes, spacePerMeter);

    console.log('lottery result', storages);

    displayLottery(storages, totalArea, totalStorages, spacePerMeter);
  });
}

start();
